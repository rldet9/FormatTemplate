/**
 * Reading a phone number against the numbering plans
 *
 * @version 2.0.0
 * @module FormatTemplate/transforms/phone/read
 *
 * @description
 * Reduces an input to a phone number: a calling code and a national
 * significant number (NSN). The steps are libphonenumber's, on the generated
 * plans (ADR-0016):
 *
 * 1. every non-digit character is ignored;
 * 2. an input starting with `+` or `00` is **international**: the calling code
 *    that prefixes the digits selects the plans, and a national prefix written
 *    after it (`+44 (0)20…`) is dropped;
 * 3. otherwise the input is **national**, read with the plan of
 *    `defaultCountry`, whose national prefix is dropped (`0`, `1`, `8`…) or
 *    rewritten (a seven-digit local number of a single-area territory gets its
 *    area code);
 * 4. the NSN must have a possible length of the plan and match its general
 *    pattern.
 *
 * Two rules are the node's own, stricter than libphonenumber (ADR-0002):
 *
 * - a national input **without** the national prefix its plan writes is
 *   refused — `320000000` in France is a zero lost upstream, not a number to
 *   repair silently;
 * - only `+` and `00` mark an international input: neither a country's own
 *   international prefix (`011` in North America) nor a calling code written
 *   without `+` is guessed.
 *
 * The node **normalizes, it does not validate**: a number matching the general
 * pattern of its plan is not necessarily an assigned number.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { FT_CODES, ftDiagnostic, type FtDiagnostic } from '../../kernel/diagnostics';
import { matchAtStart, matchesWhole, replaceAtStart } from './patterns';
import type { NumberingPlan } from './planTypes';
import {
	callingCodeOf,
	chooseFormat,
	planForCountry,
	plansForCallingCode,
	renderingPlan,
} from './plans';

/** A phone number, read. */
export interface PhoneNumber {
	/** Country calling code, without `+`. */
	callingCode: string;
	/** National significant number: national prefix excluded. */
	nsn: string;
}

/** Result of reading an input. */
export type ReadResult =
	| { ok: true; number: PhoneNumber }
	| { ok: false; diagnostic: FtDiagnostic };

/** E.164 caps a number at 15 digits; `00` adds two. Anything longer is no phone number. */
const MAX_DIGITS = 17;

/** Outcome of the length check, as libphonenumber names it. */
type LengthCheck = 'possible' | 'local-only' | 'too-short' | 'too-long' | 'invalid-length';

/**
 * Checks the length of an NSN against a plan — libphonenumber's `testNumberLength`.
 *
 * @param nsn - National significant number
 * @param plan - Numbering plan
 * @returns Outcome of the check
 */
function checkLength(nsn: string, plan: NumberingPlan): LengthCheck {
	const length = nsn.length;
	if (plan.localLengths?.includes(length)) return 'local-only';
	if (length < plan.lengths[0]) return 'too-short';
	if (length > plan.lengths[plan.lengths.length - 1]) return 'too-long';
	return plan.lengths.includes(length) ? 'possible' : 'invalid-length';
}

/** `true` if the NSN has a possible length of the plan and matches its general pattern. */
const fitsPlan = (nsn: string, plan: NumberingPlan): boolean =>
	checkLength(nsn, plan) === 'possible' && matchesWhole(plan.pattern, nsn);

/**
 * Drops or rewrites the national prefix — libphonenumber's `maybeStripNationalPrefixAndCarrierCode`.
 *
 * @param digits - Digits of a national input, or what follows the calling code
 * @param plan - Plan whose prefix rule applies
 * @returns Digits without the prefix, or `undefined` if no prefix applies
 *
 * @remarks
 * A prefix is only dropped if doing so does not turn a number that matched the
 * plan into one that no longer does: `0` is not dropped from an Italian NSN.
 */
function stripNationalPrefix(digits: string, plan: NumberingPlan): string | undefined {
	const forParsing = plan.nationalPrefixForParsing ?? plan.nationalPrefix;
	if (forParsing === undefined || digits === '') return undefined;
	const match = matchAtStart(forParsing, digits);
	if (!match) return undefined;

	const viable = matchesWhole(plan.pattern, digits);
	const rule = plan.nationalPrefixTransformRule;
	const stripped =
		rule === undefined || match[match.length - 1] === undefined
			? digits.slice(match[0].length)
			: replaceAtStart(forParsing, digits, rule);
	if (viable && !matchesWhole(plan.pattern, stripped)) return undefined;
	return stripped;
}

/**
 * Drops the national prefix if what remains can still be a complete number.
 *
 * @param digits - Digits of a national input, or what follows the calling code
 * @param plan - Plan whose prefix rule applies
 * @returns NSN, and whether a prefix was dropped
 */
function withoutNationalPrefix(digits: string, plan: NumberingPlan): { nsn: string; prefixed: boolean } {
	const stripped = stripNationalPrefix(digits, plan);
	if (stripped === undefined) return { nsn: digits, prefixed: false };
	const length = checkLength(stripped, plan);
	if (length === 'too-short' || length === 'local-only' || length === 'invalid-length') {
		return { nsn: digits, prefixed: false };
	}
	return { nsn: stripped, prefixed: true };
}

/**
 * Describes the possible lengths of a plan, for a message.
 *
 * @param plan - Numbering plan
 * @returns `9`, `8 or 9`, `4 to 15`…
 */
function describeLengths(plan: NumberingPlan): string {
	const { lengths } = plan;
	const first = lengths[0];
	const last = lengths[lengths.length - 1];
	if (lengths.length === 1) return String(first);
	if (lengths.length === last - first + 1) return `${first} to ${last}`;
	return `${lengths.slice(0, -1).join(', ')} or ${last}`;
}

/** `true` if the digits are numerous enough to be no phone number — checked before any pattern. */
const tooLong = (digits: string): ReadResult | undefined =>
	digits.length > MAX_DIGITS
		? {
				ok: false,
				diagnostic: ftDiagnostic(
					FT_CODES.PHONE_LENGTH_MISMATCH,
					`${digits.length} digits: longer than any phone number (15 digits at most).`,
				),
			}
		: undefined;

/**
 * Reads an international input.
 *
 * @param digits - Digits after `+` or `00`
 * @returns Phone number, or the diagnostic of the failure
 */
function readInternational(digits: string): ReadResult {
	const callingCode = callingCodeOf(digits);
	if (callingCode === undefined) {
		return {
			ok: false,
			diagnostic: ftDiagnostic(
				FT_CODES.PHONE_PLAN_UNSUPPORTED,
				'Calling code assigned to no country of the numbering-plan table (non-geographic services such ' +
					'as +800 included). The value is left untouched rather than truncated.',
			),
		};
	}

	const overflow = tooLong(digits);
	if (overflow) return overflow;

	const territories = plansForCallingCode(callingCode);
	// The prefix rule of the main territory applies, as in libphonenumber; the number
	// then belongs to whichever territory of the code it fits.
	const { nsn } = withoutNationalPrefix(digits.slice(callingCode.length), territories[0].plan);
	if (territories.some(({ plan }) => fitsPlan(nsn, plan))) {
		return { ok: true, number: { callingCode, nsn } };
	}

	const main = territories[0].plan;
	if (territories.some(({ plan }) => checkLength(nsn, plan) === 'possible')) {
		return {
			ok: false,
			diagnostic: ftDiagnostic(
				FT_CODES.PHONE_NOT_IN_PLAN,
				`The digits after calling code +${callingCode} are not a number of its numbering plan.`,
			),
		};
	}
	return {
		ok: false,
		diagnostic: ftDiagnostic(
			FT_CODES.PHONE_LENGTH_MISMATCH,
			`${nsn.length} digit(s) after calling code +${callingCode}, ${describeLengths(main)} expected ` +
				`for the ${territories[0].iso2} plan.`,
		),
	};
}

/**
 * Reads a national input with the plan of `defaultCountry`.
 *
 * @param digits - Digits of the input
 * @param defaultCountry - ISO2 code of the plan
 * @returns Phone number, or the diagnostic of the failure
 */
function readNational(digits: string, defaultCountry: string): ReadResult {
	const territory = planForCountry(defaultCountry);
	if (!territory) {
		return {
			ok: false,
			diagnostic: ftDiagnostic(
				FT_CODES.PHONE_PLAN_UNSUPPORTED,
				`Numbering plan "${defaultCountry}" is not in the table: use the ISO 3166-1 alpha-2 code of a ` +
					'country.',
				{ parameter: 'defaultCountry' },
			),
		};
	}

	const overflow = tooLong(digits);
	if (overflow) return overflow;

	const { iso2, plan } = territory;
	const { nsn, prefixed } = withoutNationalPrefix(digits, plan);
	if (checkLength(nsn, plan) !== 'possible') {
		const prefix = plan.nationalPrefix === undefined ? '' : ` after the national prefix "${plan.nationalPrefix}"`;
		return {
			ok: false,
			diagnostic: ftDiagnostic(
				FT_CODES.PHONE_LENGTH_MISMATCH,
				`${digits.length} digit(s) in ${iso2} national format: ${describeLengths(plan)} digit(s)${prefix} ` +
					'expected.',
			),
		};
	}
	if (!matchesWhole(plan.pattern, nsn)) {
		return {
			ok: false,
			diagnostic: ftDiagnostic(
				FT_CODES.PHONE_NOT_IN_PLAN,
				`The digits are not a number of the ${iso2} numbering plan.`,
			),
		};
	}
	if (!prefixed && plan.nationalPrefix !== undefined) {
		// The node's own rule: a plan that writes its national prefix expects it. Without it,
		// the input is short of one digit — the symptom of a zero lost upstream.
		const format = chooseFormat(renderingPlan(plan.callingCode).plan, nsn, false);
		if (format?.prefixRequired) {
			return {
				ok: false,
				diagnostic: ftDiagnostic(
					FT_CODES.PHONE_LENGTH_MISMATCH,
					`${digits.length} digit(s) in ${iso2} national format without the national prefix ` +
						`"${plan.nationalPrefix}", which this plan writes: a leading digit lost upstream?`,
				),
			};
		}
	}
	return { ok: true, number: { callingCode: plan.callingCode, nsn } };
}

/**
 * Reduces an input to a phone number.
 *
 * @param raw - Text value, already turned into a string
 * @param defaultCountry - ISO2 code of the plan used to read a national input
 * @returns Phone number, or the diagnostic of the failure
 *
 * @example
 * ```ts
 * readPhoneNumber('+44 20 7946 0958', 'FR');
 * // { ok: true, number: { callingCode: '44', nsn: '2079460958' } }
 *
 * readPhoneNumber('320000000', 'FR');
 * // { ok: false, diagnostic: FT_PHONE_LENGTH_MISMATCH } — the 0 is missing
 * ```
 */
export function readPhoneNumber(raw: string, defaultCountry: string): ReadResult {
	const digits = raw.replace(/\D/g, '');
	if (digits === '') {
		return {
			ok: false,
			diagnostic: ftDiagnostic(FT_CODES.PHONE_UNPARSEABLE, 'No usable digit in the value.'),
		};
	}
	const plus = raw.trim().startsWith('+');
	if (plus || digits.startsWith('00')) return readInternational(plus ? digits : digits.slice(2));
	return readNational(digits, defaultCountry);
}
