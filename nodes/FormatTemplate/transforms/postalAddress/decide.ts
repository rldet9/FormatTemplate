/**
 * The verdict on an address — the geocoder's answer, confronted with the input
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/postalAddress/decide
 *
 * @description
 * ADR-0013. The geocoder ranks; the verdict judges. The best candidate is the
 * **first** one, in the geocoder's order — never "the first one with a house
 * number": on 2026-10-25, for `1 bis rue des Écoles 75005 Paris`, the second
 * answer was a house number on **another** street.
 *
 * Checks, on the best candidate:
 *
 * 1. **street** — same type when the input states one, same name up to typos
 *    and omissions (`similarity.ts`);
 * 2. **house number** — same number, same repetition index (`B` ≡ `BIS`);
 * 3. **locality** — at least one of the given postcode and municipality must
 *    agree; the other one is then a correction. When only a postcode is given,
 *    a postcode of the same department is a correction, another department a
 *    disagreement;
 * 4. **ambiguity** — another candidate, within `ambiguityMargin` of the best,
 *    that designates a different place and matches the input as well;
 * 5. **precision** — the house number when the input gives one (or the
 *    configured minimum, if lower);
 * 6. **score** — at least `minScore`: a last safety net, never the judge.
 *
 * Verdicts, in order of precedence: `not_found`, `mismatch`, `ambiguous`,
 * `imprecise`, `corrected`, `verified`.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import type { AddressCandidate, AddressPrecision } from '../../ports/geocoder';
import type { ParsedAddress } from './parseInput';
import { cityKey, compareNames, compareStreets, type Agreement } from './similarity';
import { toPostalForm } from './text';
import { REPETITION_INDICES } from './vocabulary';

/** Verdict on an address. */
export type AddressVerdict =
	| 'verified'
	| 'corrected'
	| 'imprecise'
	| 'mismatch'
	| 'ambiguous'
	| 'not_found';

/** A field the geocoder corrected. */
export type CorrectionField = 'street' | 'postcode' | 'city';

/** Thresholds of the verdict. */
export interface DecisionOptions {
	/** Minimum geocoder score of the best candidate. */
	minScore: number;
	/** Score gap under which two different places are ambiguous. */
	ambiguityMargin: number;
	/** Dice coefficient under which two street names differ. */
	streetSimilarity: number;
	/** Precision required when the input gives a house number. */
	minimumPrecision: AddressPrecision;
}

/** The verdict and what it rests on. */
export interface AddressDecision {
	verdict: AddressVerdict;
	/** The candidate the verdict is about — absent for `not_found`. */
	candidate?: AddressCandidate;
	/** Fields corrected by the geocoder (for `corrected`). */
	corrections: CorrectionField[];
	/** What disagrees with the input (for `mismatch`). */
	disagreements: string[];
}

/** Precision ranks: the higher, the more precise. */
const PRECISION_RANK: Readonly<Record<AddressPrecision, number>> = {
	housenumber: 3,
	street: 2,
	locality: 2,
	municipality: 1,
};

/** What one candidate says about the input. */
interface Assessment {
	disagreements: string[];
	corrections: CorrectionField[];
	/** Similarity of the street names, for comparing rivals. */
	streetSimilarity: number;
	precisionOk: boolean;
}

/**
 * Department of a postcode: two digits, three overseas.
 *
 * @param postcode - Five-digit postcode
 * @returns Department prefix
 */
function department(postcode: string): string {
	return /^9[78]/.test(postcode) ? postcode.slice(0, 3) : postcode.slice(0, 2);
}

/**
 * Normalizes a house number of the geocoder: `1B` → `{ number: '1', repetition: 'BIS' }`.
 *
 * @param housenumber - House number as written by the geocoder
 * @returns Number and normalized repetition index
 */
function readHouseNumber(housenumber: string): { number: string; repetition?: string } {
	const match = /^(\d+)\s*([A-Za-z]*)/.exec(housenumber.trim());
	if (!match) return { number: housenumber.trim() };
	const suffix = match[2].toUpperCase();
	return {
		number: String(Number(match[1])),
		...(suffix ? { repetition: REPETITION_INDICES[suffix] ?? suffix } : {}),
	};
}

/**
 * Removes the municipality from the end of a street typed without a postcode
 * (`8 bd du Port Amiens`).
 *
 * @param street - Street as parsed
 * @param candidate - Candidate whose municipality may close the street
 * @returns The street without the municipality and the municipality, or `undefined`
 */
function splitTrailingCity(
	street: string,
	candidate: AddressCandidate,
): { street: string; city: string } | undefined {
	const words = street.split(' ');
	for (const name of [candidate.city, candidate.oldCity]) {
		if (!name) continue;
		const size = toPostalForm(name, true).split(' ').length;
		if (words.length <= size) continue;
		const tail = words.slice(-size).join(' ');
		if (toPostalForm(tail, true) === toPostalForm(name, true)) {
			return { street: words.slice(0, -size).join(' '), city: tail };
		}
	}
	return undefined;
}

/**
 * Confronts one candidate with the input.
 *
 * @param address - The restructured input
 * @param candidate - A geocoder candidate
 * @param options - Thresholds
 * @returns What disagrees, what was corrected, and whether the precision suffices
 */
function assess(
	address: ParsedAddress,
	candidate: AddressCandidate,
	options: DecisionOptions,
): Assessment {
	const disagreements: string[] = [];
	const corrections: CorrectionField[] = [];

	let street = address.street;
	let city = address.city;
	if (street && !address.postcode && !address.city) {
		const split = splitTrailingCity(street, candidate);
		if (split) ({ street, city } = split);
	}

	// --- 1. Street ------------------------------------------------------------------
	let streetSimilarity = 0;
	const answerStreet = candidate.street ?? (candidate.precision !== 'municipality' ? candidate.name : undefined);
	if (street && answerStreet) {
		const comparison = compareStreets(street, answerStreet, options.streetSimilarity);
		streetSimilarity = comparison.similarity;
		if (comparison.agreement === 'different') {
			disagreements.push(comparison.typeConflict ? 'street type' : 'street');
		} else if (comparison.agreement !== 'exact') {
			corrections.push('street');
		}
	}

	// --- 2. House number ---------------------------------------------------------
	if (address.housenumber && candidate.housenumber) {
		const answer = readHouseNumber(candidate.housenumber);
		if (answer.number !== address.housenumber || answer.repetition !== address.repetition) {
			disagreements.push('house number');
		}
	}

	// --- 3. Locality ----------------------------------------------------------------
	const postcodeGiven = address.postcode !== undefined;
	const postcodeAgrees = postcodeGiven && address.postcode === candidate.postcode;
	let cityAgreement: Agreement | undefined;
	if (city) {
		const input = cityKey(city);
		const answers = [candidate.city, candidate.oldCity].filter((name): name is string => !!name);
		const ranks: Agreement[] = ['exact', 'fuzzy', 'partial', 'different'];
		cityAgreement = answers
			.map((name) => compareNames(input, cityKey(name), 0.8).agreement)
			.sort((a, b) => ranks.indexOf(a) - ranks.indexOf(b))[0] ?? 'different';
	}
	const cityAgrees = cityAgreement !== undefined && cityAgreement !== 'different';
	if (postcodeGiven || city) {
		if (!postcodeAgrees && !cityAgrees) {
			const sameDepartment =
				postcodeGiven &&
				candidate.postcode !== undefined &&
				department(address.postcode as string) === department(candidate.postcode);
			if (postcodeGiven && !city && sameDepartment) corrections.push('postcode');
			else disagreements.push('locality');
		} else {
			if (postcodeGiven && !postcodeAgrees) corrections.push('postcode');
			if (city && cityAgreement !== 'exact') corrections.push('city');
		}
	}

	// --- 5. Precision ---------------------------------------------------------------
	const requested = address.housenumber ? PRECISION_RANK.housenumber : PRECISION_RANK.street;
	const required = Math.min(PRECISION_RANK[options.minimumPrecision], requested);
	const precisionOk = PRECISION_RANK[candidate.precision] >= required;

	return { disagreements, corrections, streetSimilarity, precisionOk };
}

/**
 * Tells whether two candidates designate different places.
 *
 * @param a - First candidate
 * @param b - Second candidate
 * @returns `true` if their street, number or municipality differ
 */
function differentPlace(a: AddressCandidate, b: AddressCandidate): boolean {
	const key = (candidate: AddressCandidate) =>
		[
			toPostalForm(candidate.street ?? candidate.name ?? '', true),
			candidate.housenumber ?? '',
			candidate.citycode ?? toPostalForm(candidate.city ?? '', true),
		].join('|');
	return key(a) !== key(b);
}

/**
 * Judges the geocoder candidates against the input.
 *
 * @param address - The restructured input
 * @param candidates - Geocoder candidates, in the geocoder's order
 * @param options - Thresholds
 * @returns The verdict and what it rests on
 *
 * @example
 * ```ts
 * decideAddress(parsed('8 bd du port amiens'), [boulevardDuPort8, portDAmont8], DEFAULTS);
 * // { verdict: 'verified', candidate: boulevardDuPort8, corrections: [], disagreements: [] }
 * ```
 */
export function decideAddress(
	address: ParsedAddress,
	candidates: readonly AddressCandidate[],
	options: DecisionOptions,
): AddressDecision {
	const best = candidates[0];
	if (!best || best.score < options.minScore) {
		return { verdict: 'not_found', ...(best ? { candidate: best } : {}), corrections: [], disagreements: [] };
	}

	const verdict = (value: AddressVerdict, assessment?: Assessment): AddressDecision => ({
		verdict: value,
		candidate: best,
		corrections: assessment?.corrections ?? [],
		disagreements: assessment?.disagreements ?? [],
	});

	const assessment = assess(address, best, options);
	if (assessment.disagreements.length > 0) return verdict('mismatch', assessment);

	// A rival is a different place, nearly as relevant, that matches the input as well.
	const rival = candidates.slice(1).find((candidate) => {
		if (best.score - candidate.score >= options.ambiguityMargin) return false;
		if (!differentPlace(best, candidate)) return false;
		const other = assess(address, candidate, options);
		return other.disagreements.length === 0 && other.streetSimilarity >= assessment.streetSimilarity;
	});
	if (rival) return verdict('ambiguous', assessment);

	if (!assessment.precisionOk) return verdict('imprecise', assessment);
	if (assessment.corrections.length > 0) return verdict('corrected', assessment);
	return verdict('verified', assessment);
}
