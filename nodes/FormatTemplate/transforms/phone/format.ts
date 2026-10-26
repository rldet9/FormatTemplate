/**
 * Phone number normalization — the pure function of typeVersion 6
 *
 * @version 2.0.0
 * @module FormatTemplate/transforms/phone/format
 *
 * @description
 * typeVersion 5 mixed two things in a single loop over the mask: **reading**
 * the input and **rendering** the output. It consumed one digit per `#` **or**
 * `0` slot, and never compared the number of digits with the mask's capacity.
 * Hence three behaviours measured on a real n8n instance on 2026-09-15: `''`
 * rendered `0# ## ## ## ##`, `04 77 00 00` rendered `04 77 00 00 ##`, and
 * `+44 20 7946 0958` was cut to `44 20 79 46 09`.
 *
 * typeVersion 6 separates them:
 *
 * 1. **Reading** (`read.ts`) — the input is reduced to a phone number: a
 *    calling code and a national significant number (NSN). An input starting
 *    with `+` or `00` is read as international, otherwise as national in the
 *    `defaultCountry`.
 * 2. **Rendering** (`render.ts`) — `national`, `international`, `e164`, or
 *    `mask` here.
 *
 * Both work on the numbering plans of every country, generated from the
 * libphonenumber metadata (ADR-0016). Lengths vary from one country to another
 * and within a country: Germany alone has NSNs of 4 to 15 digits.
 *
 * **Mask grammar of typeVersion 6**: only `#` is a digit slot, `\#` renders a
 * literal `#`, everything else is copied. The `0` is a literal — the fix for
 * the typeVersion 5 mask that consumed a digit on `0`. A mask without `#` is a
 * configuration error.
 *
 * **The mask consumes the national significant number** (the country calling
 * code and the national prefix are excluded): `+33 (0) # ## ## ## ##` has
 * nine slots for the nine digits of a French NSN, and renders
 * `+33 (0) 3 20 00 00 00`. In a plan of variable length, a mask fits the
 * numbers of one length only; the others are left untouched with
 * `FT_PHONE_LENGTH_MISMATCH`.
 *
 * ADR-0002: a conversion that cannot apply **never** produces an approximate
 * value. The original value is kept and the diagnostic says why.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { FT_CODES, ftDiagnostic, type FtDiagnostic } from '../../kernel/diagnostics';
import {
	outcomeFailed,
	outcomeOk,
	outcomeUnchanged,
	type FormatOutcome,
} from '../../kernel/outcome';
import { readPhoneNumber } from './read';
import { renderPhoneNumber } from './render';

/** Output shapes offered by typeVersion 6. */
export type PhoneOutput = 'national' | 'international' | 'e164' | 'mask';

/** Parameters of a `phone` row in typeVersion 6. */
export interface PhoneParams {
	/** Output shape; `national` by default. */
	phoneOutput?: PhoneOutput;
	/** Country used to read a national input; `FR` by default. */
	defaultCountry?: string;
	/** Output mask, required for `phoneOutput: 'mask'`. */
	phoneMask?: string;
}

/** A mask token: a digit slot, or a literal. */
type MaskToken = { slot: true } | { slot: false; text: string };

/**
 * Parses a mask with the typeVersion 6 grammar.
 *
 * @param mask - Configured mask
 * @returns Mask tokens
 *
 * @example
 * ```ts
 * parseMask('+33 (0) #');  // literals + one slot
 * parseMask('n\\# #');     // a literal `#`, then a slot
 * ```
 */
function parseMask(mask: string): MaskToken[] {
	const tokens: MaskToken[] = [];
	for (let i = 0; i < mask.length; i++) {
		const char = mask[i];
		if (char === '\\' && mask[i + 1] === '#') {
			tokens.push({ slot: false, text: '#' });
			i++;
			continue;
		}
		tokens.push(char === '#' ? { slot: true } : { slot: false, text: char });
	}
	return tokens;
}

/**
 * Counts the digit slots of a mask.
 *
 * @param mask - Configured mask
 * @returns Capacity of the mask
 *
 * @example
 * ```ts
 * maskCapacity('0# ## ## ## ##'); // 9
 * ```
 */
export function maskCapacity(mask: string): number {
	return parseMask(mask).filter((token) => token.slot).length;
}

/**
 * Checks that a mask is usable — a **configuration** error otherwise.
 *
 * @param mask - Configured mask
 * @returns Diagnostic if the mask is unusable, otherwise `undefined`
 *
 * @remarks
 * A typeVersion 5 mask `{0:…}` is refused explicitly: under the typeVersion 6
 * grammar its wrapper would be copied as is into the output, and its leading
 * `0` would stop being a slot. A refused setup is better than a
 * `{0:03 20 00 00 00}` delivered without a word.
 *
 * @example
 * ```ts
 * validateMask('+33 (0) # ## ## ## ##'); // undefined
 * validateMask('0033');                  // FT_PHONE_MASK_INVALID
 * ```
 */
export function validateMask(mask: string): FtDiagnostic | undefined {
	if (typeof mask !== 'string' || mask.trim() === '') {
		return ftDiagnostic(FT_CODES.PHONE_MASK_INVALID, 'Empty phone mask.', {
			parameter: 'phoneMask',
		});
	}
	if (/^\{\d+:.*\}$/.test(mask.trim())) {
		return ftDiagnostic(
			FT_CODES.PHONE_MASK_INVALID,
			`typeVersion 5 mask cannot be used as is: "${mask}". In typeVersion 6 the mask is written without ` +
				'the {0:…} wrapper and only "#" is a digit slot ("0" is a literal). ' +
				'Example: 0# ## ## ## ##',
			{ parameter: 'phoneMask' },
		);
	}
	if (maskCapacity(mask) === 0) {
		return ftDiagnostic(
			FT_CODES.PHONE_MASK_INVALID,
			`Mask without any digit slot: "${mask}". Use "#" for each expected digit.`,
			{ parameter: 'phoneMask' },
		);
	}
	return undefined;
}

/**
 * Renders a national significant number through a mask.
 *
 * @param mask - Mask, typeVersion 6 grammar
 * @param nsn - National significant number
 * @returns Rendered string
 */
function renderMask(mask: string, nsn: string): string {
	let index = 0;
	let result = '';
	for (const token of parseMask(mask)) {
		result += token.slot ? nsn[index++] : token.text;
	}
	return result;
}

/**
 * Normalizes a phone number — pure function of typeVersion 6.
 *
 * @param value - Value read from the item, unconverted
 * @param params - Row parameters (`phoneOutput`, `defaultCountry`, `phoneMask`)
 * @returns Typed result
 *
 * @example
 * ```ts
 * formatPhone('+33 3 20 00 00 00', { phoneOutput: 'national' });
 * // { status: 'ok', value: '03 20 00 00 00', diagnostics: [] }
 *
 * formatPhone('04 77 00 00', {});
 * // { status: 'failed', diagnostics: [FT_PHONE_LENGTH_MISMATCH] }
 *
 * formatPhone('', {});
 * // { status: 'unchanged', diagnostics: [FT_VALUE_EMPTY] }
 * ```
 */
export function formatPhone(value: unknown, params: PhoneParams = {}): FormatOutcome {
	const output: PhoneOutput = params.phoneOutput ?? 'national';
	const defaultCountry = params.defaultCountry ?? 'FR';

	if (value === null || value === undefined || String(value).trim() === '') {
		// ADR-0002: never a mask rendered in place of a missing value.
		return outcomeUnchanged([
			ftDiagnostic(FT_CODES.VALUE_EMPTY, 'Empty value: no number to normalize.', {
				severity: 'info',
			}),
		]);
	}

	const warnings: FtDiagnostic[] = [];
	if (typeof value === 'number') {
		// The leading zero of a French number disappears as soon as the value travels
		// as a `number`: it is not the node's job to reinvent it, but it must say so.
		warnings.push(
			ftDiagnostic(
				FT_CODES.PHONE_NUMERIC_INPUT,
				'Numeric value: a leading zero may have been lost before the node.',
				{ severity: 'warning' },
			),
		);
	}

	if (output === 'mask') {
		const invalid = validateMask(params.phoneMask ?? '');
		if (invalid) return outcomeFailed([invalid]);
	}

	const read = readPhoneNumber(String(value), defaultCountry);
	if (!read.ok) return outcomeFailed([...warnings, read.diagnostic]);

	if (output !== 'mask') {
		const rendered = renderPhoneNumber(read.number, output);
		return rendered.ok
			? outcomeOk(rendered.value, warnings)
			: outcomeFailed([...warnings, rendered.diagnostic]);
	}

	const mask = params.phoneMask as string;
	const { nsn } = read.number;
	const capacity = maskCapacity(mask);
	if (capacity !== nsn.length) {
		// An unserved slot never goes out as a literal: the gap itself is reported.
		return outcomeFailed([
			...warnings,
			ftDiagnostic(
				FT_CODES.PHONE_LENGTH_MISMATCH,
				`${nsn.length} digit(s) for ${capacity} mask slot(s).`,
				{ parameter: 'phoneMask' },
			),
		]);
	}

	return outcomeOk(renderMask(mask, nsn), warnings);
}
