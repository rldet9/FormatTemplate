/**
 * typeVersion 5 transformations — **frozen**
 *
 * @version 5.0.0 (frozen)
 * @module FormatTemplate/v5/legacyTransforms
 *
 * @description
 * The body of these three functions is taken **character for character** from
 * the `PhoneHandler`, `TextCaseHandler` and `CountryHandler` classes of
 * typeVersion 5, defects included.
 *
 * ⚠️ **Fix nothing here.** ADR-0004: a workflow saved in typeVersion 5 is
 * never migrated on load, and its behaviour must not change under its feet.
 * The fixes live in the pure modules (`transforms/<type>/format.ts`), served
 * by typeVersion 6.
 *
 * `__tests__/format-legacy-characterization.test.ts` fails if a fix leaks
 * down here.
 *
 * The only differences with the original typeVersion 5: the classes and their
 * debug logging (silent in operation) are gone, and the country conversion
 * returns a result instead of throwing — `executeLegacy` builds the
 * `NodeOperationError`, with the same message.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { COUNTRY_NAME_TO_ISO2, ISO2_CODES, normalizeCountryKey } from '../transforms/country/countryCodes';

/**
 * Applies a phone mask, typeVersion 5.
 *
 * @param raw - Input value, already turned into a string by the caller
 * @param pattern - `{0:…}` mask from the typeVersion 5 dropdown
 * @returns Rendered string
 *
 * @remarks
 * Frozen defects: `#` **and** `0` consume a digit, there is no capacity
 * check, an unserved slot goes out as a literal, and an empty string renders
 * the mask itself.
 */
export function applyPatternV5(raw: string, pattern: string): string {
	// 1. Clean the pattern (remove the curly braces)
	const cleanPattern = pattern.replace(/^\{0:/, '').replace(/\}$/, '');

	// 2. Clean the input number: drop everything but digits
	let digits = raw.replace(/\D/g, '');

	// 3. Special case: turn a French international number into national format
	if ((digits.startsWith('0033') || digits.startsWith('33')) && cleanPattern.startsWith('0')) {
		digits = digits.startsWith('0033') ? '0' + digits.substring(4) : '0' + digits.substring(2);
	}

	// 4. Apply the pattern character by character
	let result = '';
	let digitIndex = 0;

	for (const char of cleanPattern) {
		if ((char === '#' || char === '0') && digitIndex < digits.length) {
			result += digits[digitIndex++];
		} else if (char === '0' && digitIndex >= digits.length) {
			result += '0'; // literal
		} else if (char === '#' && digitIndex >= digits.length) {
			result += '#'; // optional, not replaced
		} else {
			result += char; // punctuation, space, etc.
		}
	}

	return result;
}

/**
 * Changes the case of a string, typeVersion 5.
 *
 * @param value - Input value
 * @param caseType - `uppercase`, `lowercase` or `capitalize`
 * @returns Transformed string
 *
 * @remarks
 * Frozen defect: `capitalize` uppercases the **first character of the
 * string** and lowercases everything else. The `fr-FR` locale is hard-coded.
 */
export function formatTextCaseV5(value: string, caseType: string): string {
	if (!value || typeof value !== 'string') {
		return value;
	}

	switch (caseType.toLowerCase()) {
		case 'uppercase':
			return value.toLocaleUpperCase('fr-FR');

		case 'lowercase':
			return value.toLocaleLowerCase('fr-FR');

		case 'capitalize':
			return (
				value.charAt(0).toLocaleUpperCase('fr-FR') + value.slice(1).toLocaleLowerCase('fr-FR')
			);

		default:
			return value;
	}
}

/** Result of a typeVersion 5 country conversion. */
export type CountryV5Result = { resolved: true; value: string } | { resolved: false };

/**
 * Converts a country name to ISO2, typeVersion 5.
 *
 * @param value - Input value, already turned into a string by the caller
 * @returns Resolved value, or the failure that `executeLegacy` turns into a node error
 *
 * @remarks
 * Frozen defects: an empty value is a silent pass-through, a two-letter code
 * outside the standard goes through in uppercase without a word, and
 * everything else fails — a failure that, in typeVersion 5, destroys the
 * whole batch.
 */
export function resolveCountryV5(value: string): CountryV5Result {
	const trimmed = value.trim();

	// Empty value: nothing to convert, the value is returned as is rather than
	// failing the item (a missing country is not a format error).
	if (trimmed === '') {
		return { resolved: true, value };
	}

	// 1. Already an ISO2 code in force
	const upper = trimmed.toUpperCase();
	if (ISO2_CODES.has(upper)) {
		return { resolved: true, value: upper };
	}

	// 2. Country name (French, English or common alias) — also covers the
	//    out-of-standard codes still in use, "UK" first, which must become "GB".
	const fromName = COUNTRY_NAME_TO_ISO2[normalizeCountryKey(trimmed)];
	if (fromName) {
		return { resolved: true, value: fromName };
	}

	// 3. Two letters unknown to the standard: the historical behaviour is kept
	//    (pass-through in uppercase) so as not to break existing internal codes.
	if (/^[a-zA-Z]{2}$/.test(trimmed)) {
		return { resolved: true, value: upper };
	}

	return { resolved: false };
}
