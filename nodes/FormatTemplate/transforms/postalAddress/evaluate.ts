/**
 * From a verdict to a transformation outcome
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/postalAddress/evaluate
 *
 * @description
 * Assembles the pure steps of the postal-address transformation:
 * the restructured input and the geocoder candidates go in, a
 * `FormatOutcome` comes out — the value to write, or why none is written.
 * The only step that is not here is the lookup itself, which goes through the
 * `Geocoder` port.
 *
 * An address is written back only when it is `verified`, or `corrected` with
 * `acceptCorrections` on. Every other verdict leaves the original value in
 * place (ADR-0002) and fails the transformation with its diagnostic; the
 * node's `onFieldError` policy then decides the item's fate.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { ftDiagnostic, type FtDiagnostic } from '../../kernel/diagnostics';
import { outcomeFailed, outcomeOk, type FormatOutcome } from '../../kernel/outcome';
import type { AddressCandidate } from '../../ports/geocoder';
import { ADDRESS_CODES } from './codes';
import { decideAddress, type AddressDecision } from './decide';
import type { ParsedAddress } from './parseInput';
import type { PostalAddressSettings } from './params';
import { buildPostalLines, type PostalLine } from './postalLines';

/** The structured value written under `outputFormat: structured`. */
export interface StructuredAddress {
	verdict: 'verified' | 'corrected';
	corrections: string[];
	precision: AddressCandidate['precision'];
	score: number;
	label: string;
	postalLines: string[];
	housenumber?: string;
	street?: string;
	postcode?: string;
	city?: string;
	oldCity?: string;
	district?: string;
	citycode?: string;
	banId?: string;
	id?: string;
	latitude?: number;
	longitude?: number;
}

/**
 * Builds the diagnostic of a refused verdict.
 *
 * @param decision - The verdict
 * @param settings - Thresholds, quoted in the message
 * @returns Diagnostic, without any value of the address
 */
function refusal(decision: AddressDecision, settings: PostalAddressSettings): FtDiagnostic {
	switch (decision.verdict) {
		case 'mismatch':
			return ftDiagnostic(
				ADDRESS_CODES.MISMATCH,
				`The best match disagrees with the input on: ${decision.disagreements.join(', ')}.`,
			);
		case 'ambiguous':
			return ftDiagnostic(
				ADDRESS_CODES.AMBIGUOUS,
				`Several different addresses match the input within ${settings.ambiguityMargin} of each ` +
					'other: add the postcode, the municipality or the house number.',
			);
		case 'imprecise':
			return ftDiagnostic(
				ADDRESS_CODES.IMPRECISE,
				`The best match is a ${decision.candidate?.precision ?? 'place'}, less precise than ` +
					'required: the house number is unknown to the national base.',
			);
		case 'corrected':
			return ftDiagnostic(
				ADDRESS_CODES.CORRECTED,
				`The address only matches after correcting: ${decision.corrections.join(', ')} ` +
					'(acceptCorrections is off).',
			);
		case 'not_found':
		default:
			return ftDiagnostic(
				ADDRESS_CODES.NOT_FOUND,
				decision.candidate
					? `The best match scores ${decision.candidate.score.toFixed(2)}, below the minimum of ${settings.minScore}.`
					: 'No address of the national base matches the input.',
			);
	}
}

/**
 * Builds the value written back.
 *
 * @param decision - An accepted verdict
 * @param candidate - Its candidate
 * @param lines - Its postal lines
 * @param settings - Output format
 * @returns The value for `outputFormat`
 */
function outputValue(
	decision: AddressDecision,
	candidate: AddressCandidate,
	lines: PostalLine[],
	settings: PostalAddressSettings,
): unknown {
	const texts = lines.map((line) => line.text);
	if (settings.outputFormat === 'label') return candidate.label;
	if (settings.outputFormat === 'postalLines') return texts;
	const structured: StructuredAddress = {
		verdict: decision.verdict as StructuredAddress['verdict'],
		corrections: decision.corrections,
		precision: candidate.precision,
		score: candidate.score,
		label: candidate.label,
		postalLines: texts,
	};
	const optional = [
		'housenumber',
		'street',
		'postcode',
		'city',
		'oldCity',
		'district',
		'citycode',
		'banId',
		'id',
		'latitude',
		'longitude',
	] as const;
	for (const key of optional) {
		if (candidate[key] !== undefined) (structured as unknown as Record<string, unknown>)[key] = candidate[key];
	}
	return structured;
}

/**
 * Judges the candidates and builds the outcome of the transformation.
 *
 * @param address - The restructured input
 * @param candidates - Geocoder candidates, in the geocoder's order
 * @param settings - Resolved parameters
 * @returns `ok` with the formatted value, or `failed` with the verdict's diagnostic
 *
 * @example
 * ```ts
 * evaluateAddress(parsed('8 bd du port amiens'), candidates, ADDRESS_DEFAULTS);
 * // { status: 'ok', value: ['8 BOULEVARD DU PORT', '80000 AMIENS'], diagnostics: [] }
 * ```
 */
export function evaluateAddress(
	address: ParsedAddress,
	candidates: readonly AddressCandidate[],
	settings: PostalAddressSettings,
): FormatOutcome {
	const decision = decideAddress(address, candidates, settings);
	const accepted =
		decision.verdict === 'verified' || (decision.verdict === 'corrected' && settings.acceptCorrections);
	if (!accepted || !decision.candidate) return outcomeFailed([refusal(decision, settings)]);

	const { lines, diagnostics } = buildPostalLines(address, decision.candidate, settings);
	const warnings = [
		...(decision.verdict === 'corrected'
			? [
					ftDiagnostic(
						ADDRESS_CODES.CORRECTED,
						`Address accepted after correcting: ${decision.corrections.join(', ')}.`,
						{ severity: 'warning' },
					),
				]
			: []),
		...diagnostics,
	];
	return outcomeOk(outputValue(decision, decision.candidate, lines, settings), warnings);
}
