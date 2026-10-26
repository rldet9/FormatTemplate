/**
 * Numbering plans of every country — lookup
 *
 * @version 2.0.0
 * @module FormatTemplate/transforms/phone/plans
 *
 * @description
 * The plans are a table **generated** from the libphonenumber metadata at a
 * pinned version (`numberingPlans.ts`, `scripts/gen_phone_plans.js`): every
 * country the metadata describes, 245 territories. ADR-0016 amends ADR-0005:
 * still no runtime dependency, but no longer a short hand-written table.
 *
 * Three plans keep the reading and the grouping of the first typeVersion 6
 * release — FR, US, CA — so that a value the node already formatted is
 * formatted identically (ADR-0004). The generator applies that, not this
 * module.
 *
 * Non-geographic services (+800, +808, +870, +878, +881 to +883, +888, +979)
 * are not in the table: their numbers yield `FT_PHONE_PLAN_UNSUPPORTED` and
 * stay untouched.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { CALLING_CODES, NUMBERING_PLANS } from './numberingPlans';
import { matchAtStart, matchesWhole } from './patterns';
import type { NumberingPlan, PlanFormat } from './planTypes';

/** A plan, with the territory it belongs to. */
export interface TerritoryPlan {
	/** ISO 3166-1 alpha-2 code. */
	iso2: string;
	plan: NumberingPlan;
}

/** `true` if the table holds the key itself — never a property inherited from `Object`. */
const owns = (table: object, key: string): boolean =>
	Object.prototype.hasOwnProperty.call(table, key);

/**
 * Returns the plan of a country.
 *
 * @param iso2 - ISO 3166-1 alpha-2 code, case-insensitive
 * @returns Plan, or `undefined` if the table does not hold the country
 *
 * @example
 * ```ts
 * planForCountry('be')?.plan.callingCode; // '32'
 * planForCountry('EU');                   // undefined
 * ```
 */
export function planForCountry(iso2: string): TerritoryPlan | undefined {
	const code = String(iso2 ?? '')
		.trim()
		.toUpperCase();
	return owns(NUMBERING_PLANS, code) ? { iso2: code, plan: NUMBERING_PLANS[code] } : undefined;
}

/**
 * Returns the calling code that prefixes the digits of an international input.
 *
 * @param digits - Digits after `+` or `00`
 * @returns Calling code, or `undefined` if none of the table prefixes the digits
 *
 * @remarks
 * Calling codes form a prefix code (the generator checks it): at most one of
 * them prefixes the digits.
 *
 * @example
 * ```ts
 * callingCodeOf('442079460958'); // '44'
 * callingCodeOf('80012345678');  // undefined — a non-geographic service
 * ```
 */
export function callingCodeOf(digits: string): string | undefined {
	for (const length of [1, 2, 3]) {
		const candidate = digits.slice(0, length);
		if (candidate.length === length && owns(CALLING_CODES, candidate)) return candidate;
	}
	return undefined;
}

/**
 * Returns the territories sharing a calling code, its main territory first.
 *
 * @param callingCode - Calling code, without `+`
 * @returns Territories with their plans; empty for an unknown code
 *
 * @example
 * ```ts
 * plansForCallingCode('44').map((t) => t.iso2); // ['GB', 'GG', 'IM', 'JE']
 * ```
 */
export function plansForCallingCode(callingCode: string): TerritoryPlan[] {
	if (!owns(CALLING_CODES, callingCode)) return [];
	return CALLING_CODES[callingCode].map((iso2) => ({ iso2, plan: NUMBERING_PLANS[iso2] }));
}

/**
 * Returns the territory whose formats render the numbers of a calling code.
 *
 * @param callingCode - Calling code of the table, without `+`
 * @returns Main territory of the code
 *
 * @remarks
 * As in libphonenumber, every number of a shared calling code is rendered with
 * the formats and the national prefix of its main territory: a Jersey number
 * is grouped like a British one, a Puerto Rican number like a US one. The
 * generator checks that the territories of a shared code have the same
 * national prefix as their main territory, and no formats of their own.
 */
export function renderingPlan(callingCode: string): TerritoryPlan {
	return plansForCallingCode(callingCode)[0];
}

/**
 * Chooses the format of a national significant number, as libphonenumber does.
 *
 * @param plan - Rendering plan of the number
 * @param nsn - National significant number
 * @param international - `true` to skip the national-only formats
 * @returns First format whose leading digits and pattern match, or `undefined`
 *
 * @example
 * ```ts
 * chooseFormat(planForCountry('BE')!.plan, '23456789', false)?.national; // '0$1 $2 $3 $4'
 * ```
 */
export function chooseFormat(
	plan: NumberingPlan,
	nsn: string,
	international: boolean,
): PlanFormat | undefined {
	for (const format of plan.formats ?? []) {
		if (international && format.international === null) continue;
		if (format.leadingDigits !== undefined && !matchAtStart(format.leadingDigits, nsn)) continue;
		if (matchesWhole(format.pattern, nsn)) return format;
	}
	return undefined;
}
