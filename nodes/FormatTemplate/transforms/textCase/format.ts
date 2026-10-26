/**
 * Text case — the pure function of typeVersion 6
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/textCase/format
 *
 * @description
 * The `capitalize` mode is called "capitalize" and does what the name means
 * in JavaScript — uppercase on the **first character of the string**,
 * lowercase everywhere else — not what a user formatting a proper noun
 * expects. `SARL DUPONT ET FILS` became `Sarl dupont et fils` in production.
 *
 * ADR-0004: `capitalize` is **not** fixed, only relabelled in the interface.
 * typeVersion 6 adds `titleCase`, which uppercases after the start of the
 * string, a space, `-`, `'`, `.`, `/` and an opening parenthesis.
 *
 * No list of particles (`de`, `van`, `von`): an implicit linguistic rule is
 * worse than a simple, announced one.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { FT_CODES, describeFtValue, ftDiagnostic } from '../../kernel/diagnostics';
import {
	outcomeFailed,
	outcomeOk,
	outcomeUnchanged,
	type FormatOutcome,
} from '../../kernel/outcome';

/** Case modes; `titleCase` is specific to typeVersion 6. */
export type TextCaseMode = 'uppercase' | 'lowercase' | 'capitalize' | 'titleCase';

/** Parameters of a `textCase` row in typeVersion 6. */
export interface TextCaseParams {
	/** Case mode; `uppercase` by default, as in typeVersion 5. */
	textCase?: TextCaseMode;
	/** Locale of the case changes; `fr-FR` by default. */
	locale?: string;
}

/**
 * Characters after which `titleCase` uppercases again.
 *
 * @remarks
 * `'` covers `O'Brien`, `-` covers `Jean-Pierre`, `.` covers `S.A.R.L`,
 * `/` and `(` cover compound company names.
 */
const TITLE_CASE_BOUNDARIES = new Set([' ', '-', "'", '’', '.', '/', '(', '\t', '\n']);

/**
 * Applies `titleCase` to a string.
 *
 * @param value - Input string
 * @param locale - Locale of the case changes
 * @returns String in title case
 *
 * @example
 * ```ts
 * toTitleCase("jean-pierre o'brien", 'fr-FR'); // "Jean-Pierre O'Brien"
 * ```
 */
export function toTitleCase(value: string, locale: string): string {
	let atBoundary = true;
	let result = '';
	for (const char of value) {
		result += atBoundary ? char.toLocaleUpperCase(locale) : char.toLocaleLowerCase(locale);
		atBoundary = TITLE_CASE_BOUNDARIES.has(char);
	}
	return result;
}

/**
 * Changes the case of a value — pure function of typeVersion 6.
 *
 * @param value - Value read from the item, unconverted
 * @param params - Row parameters (`textCase`, `locale`)
 * @returns Typed result
 *
 * @remarks
 * A non-text value is no longer returned as is in silence: typeVersion 5
 * let it through without a word, typeVersion 6 raises `FT_TEXT_NOT_STRING`.
 *
 * @example
 * ```ts
 * formatTextCase('SARL DUPONT ET FILS', { textCase: 'titleCase' });
 * // { status: 'ok', value: 'Sarl Dupont Et Fils', diagnostics: [] }
 *
 * formatTextCase(42, { textCase: 'uppercase' });
 * // { status: 'failed', diagnostics: [FT_TEXT_NOT_STRING] }
 * ```
 */
export function formatTextCase(value: unknown, params: TextCaseParams = {}): FormatOutcome {
	const mode: TextCaseMode = params.textCase ?? 'uppercase';
	const locale = params.locale && params.locale.trim() !== '' ? params.locale : 'fr-FR';

	if (typeof value !== 'string') {
		return outcomeFailed([
			ftDiagnostic(
				FT_CODES.TEXT_NOT_STRING,
				`Non-text value submitted to textCase: ${describeFtValue(value)}.`,
			),
		]);
	}
	if (value === '') {
		return outcomeUnchanged([
			ftDiagnostic(FT_CODES.VALUE_EMPTY, 'Empty value: no case to apply.', {
				severity: 'info',
			}),
		]);
	}

	switch (mode) {
		case 'uppercase':
			return outcomeOk(value.toLocaleUpperCase(locale));
		case 'lowercase':
			return outcomeOk(value.toLocaleLowerCase(locale));
		case 'capitalize':
			// typeVersion 5 semantics, kept identical (ADR-0004).
			return outcomeOk(
				value.charAt(0).toLocaleUpperCase(locale) + value.slice(1).toLocaleLowerCase(locale),
			);
		case 'titleCase':
			return outcomeOk(toTitleCase(value, locale));
		default:
			return outcomeFailed([
				ftDiagnostic(FT_CODES.TYPE_UNKNOWN, `Unknown case mode: "${String(mode)}".`, {
					parameter: 'textCase',
				}),
			]);
	}
}
