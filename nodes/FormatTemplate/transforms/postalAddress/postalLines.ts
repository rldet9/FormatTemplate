/**
 * Writing an address to the French standard — NF Z10-011
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/postalAddress/postalLines
 *
 * @description
 * ADR-0014. The rules, as published by La Poste (guide SP8855 volume 2, §3):
 *
 * - six lines at most (a seventh for the country, for mail posted abroad),
 *   **38 characters or spaces** at most each, one space between words;
 * - the last line always in uppercase, the last three advised: lines 4 to 7
 *   are written in uppercase;
 * - **no punctuation** from line 4 onwards: apostrophes, hyphens, periods and
 *   commas become spaces;
 * - an unused line is removed, never left blank.
 *
 * | Line | Content | Source |
 * |---|---|---|
 * | 1 | recipient | the input, as written |
 * | 2 | inside the building: flat, floor, staircase | the input, as written |
 * | 3 | outside the building: entrance, building, residence | the input, as written |
 * | 4 | number, repetition index, street | the national base |
 * | 5 | former municipality, when it differs from line 6 | the national base |
 * | 6 | postcode and municipality | the national base |
 * | 7 | `FRANCE`, on demand | — |
 *
 * When line 4 exceeds 38 characters, the street type is abbreviated with the
 * **official** list, and only it. A line still too long is reported, **never
 * truncated**: a truncated address is a wrong address (ADR-0002).
 *
 * Accents are removed from lines 4 to 7 by default: the standard does not
 * require it, but postal reference files are written that way.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { ftDiagnostic, type FtDiagnostic } from '../../kernel/diagnostics';
import type { AddressCandidate } from '../../ports/geocoder';
import { ADDRESS_CODES } from './codes';
import type { ParsedAddress } from './parseInput';
import { collapseSpaces, toPostalForm } from './text';
import { OFFICIAL_ABBREVIATIONS } from './vocabulary';

/** Maximum length of a line, spaces included. */
export const MAX_LINE_LENGTH = 38;

/** Options of the formatting. */
export interface PostalLinesOptions {
	/** Remove accents from lines 4 to 7. */
	stripAccents: boolean;
	/** Add `FRANCE` as line 7. */
	includeCountryLine: boolean;
}

/** One formatted line, with its number in the standard. */
export interface PostalLine {
	number: number;
	text: string;
}

/** Abbreviable street types, longest first, so that `CENTRE COMMERCIAL` wins over `CENTRE`. */
const ABBREVIABLE = Object.keys(OFFICIAL_ABBREVIATIONS).sort((a, b) => b.length - a.length);

/**
 * Writes the house number of an answer: `1B` → `1 B`, `12 bis` → `12 BIS`.
 *
 * @param housenumber - House number as written by the geocoder
 * @returns Number and repetition index, separated by a space
 */
function writeHouseNumber(housenumber: string): string {
	const match = /^(\d+)\s*(.*)$/.exec(housenumber.trim());
	return match && match[2] ? `${match[1]} ${match[2]}` : housenumber.trim();
}

/**
 * Abbreviates the street type of line 4 with the official list.
 *
 * @param number - Postal form of the number and index, or `''`
 * @param street - Postal form of the street
 * @returns The line with the type abbreviated, or the line unchanged if the
 *          street does not start with an abbreviable type
 */
function abbreviateStreetType(number: string, street: string): string {
	const type = ABBREVIABLE.find((form) => street.startsWith(`${form} `));
	const abbreviated = type ? `${OFFICIAL_ABBREVIATIONS[type]}${street.slice(type.length)}` : street;
	return collapseSpaces(`${number} ${abbreviated}`);
}

/**
 * Builds the lines of an address to the French standard.
 *
 * @param address - The restructured input (lines 1 to 3)
 * @param candidate - The accepted geocoder candidate (lines 4 to 6)
 * @param options - Formatting options
 * @returns The non-empty lines, in order, and a warning per line over 38 characters
 *
 * @example
 * ```ts
 * buildPostalLines(parsed('Appartement 12\n8 bd du port 80000 amiens'), boulevardDuPort8, {
 *   stripAccents: true, includeCountryLine: false,
 * });
 * // lines: [{ number: 2, text: 'Appartement 12' }, { number: 4, text: '8 BOULEVARD DU PORT' },
 * //         { number: 6, text: '80000 AMIENS' }]
 * ```
 */
export function buildPostalLines(
	address: ParsedAddress,
	candidate: AddressCandidate,
	options: PostalLinesOptions,
): { lines: PostalLine[]; diagnostics: FtDiagnostic[] } {
	const postal = (text: string) => toPostalForm(text, options.stripAccents);
	const lines: PostalLine[] = [];
	const push = (number: number, text: string | undefined) => {
		const value = text ? collapseSpaces(text) : '';
		if (value !== '') lines.push({ number, text: value });
	};

	push(1, address.line1.join(' '));
	push(2, address.line2.join(' '));
	push(3, address.line3.join(' '));

	// --- Line 4: number and street -------------------------------------------------
	const street = candidate.street ?? (candidate.precision !== 'municipality' ? candidate.name : undefined);
	if (street) {
		const number = candidate.housenumber ? postal(writeHouseNumber(candidate.housenumber)) : '';
		let line4 = collapseSpaces(`${number} ${postal(street)}`);
		if (line4.length > MAX_LINE_LENGTH) line4 = abbreviateStreetType(number, postal(street));
		push(4, line4);
	}

	// --- Line 5: former municipality, when it differs from the municipality ---------
	if (candidate.oldCity && candidate.city && postal(candidate.oldCity) !== postal(candidate.city)) {
		push(5, postal(candidate.oldCity));
	}

	// --- Line 6: postcode and municipality -------------------------------------------
	push(6, postal(`${candidate.postcode ?? ''} ${candidate.city ?? ''}`));

	if (options.includeCountryLine) push(7, 'FRANCE');

	const diagnostics = lines
		.filter((line) => line.text.length > MAX_LINE_LENGTH)
		.map((line) =>
			ftDiagnostic(
				ADDRESS_CODES.LINE_TOO_LONG,
				`Line ${line.number} has ${line.text.length} characters, over the ${MAX_LINE_LENGTH} the standard ` +
					'allows, after the authorized abbreviations. It is kept whole, never truncated.',
				{ severity: 'warning' },
			),
		);

	return { lines, diagnostics };
}
