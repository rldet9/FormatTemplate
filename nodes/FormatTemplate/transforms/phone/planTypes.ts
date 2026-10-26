/**
 * Shape of the generated numbering plans
 *
 * @version 2.0.0
 * @module FormatTemplate/transforms/phone/planTypes
 *
 * @description
 * The contract between the generator (`scripts/gen_phone_plans.js`) and the
 * engine: `numberingPlans.ts` is data of these types, `read.ts` and
 * `render.ts` read it. The field names follow libphonenumber's metadata, so a
 * plan can be checked against its source (ADR-0016).
 *
 * Every pattern is a source string, matched by `patterns.ts`: anchored at both
 * ends for `pattern`, at the start only for `leadingDigits` and
 * `nationalPrefixForParsing`.
 *
 * Pure module — no import of `n8n-workflow`.
 */

/** A way of grouping the digits of a national significant number (NSN). */
export interface PlanFormat {
	/** Full-match pattern on the NSN; its capturing groups feed the templates. */
	readonly pattern: string;
	/** Prefix the NSN must start with for this format to apply — the most detailed one of libphonenumber. */
	readonly leadingDigits?: string;
	/** Replacement template (`$1 $2 $3`), used when no more specific one is given. */
	readonly format: string;
	/** National template when it differs from `format`: the national prefix rule already applied (`0$1 $2`). */
	readonly national?: string;
	/** International template when it differs from `format`; `null` means the format is national-only. */
	readonly international?: string | null;
	/** `true` if the national rendering shows the national prefix and a national input may not omit it. */
	readonly prefixRequired?: true;
}

/** Numbering plan of a territory. */
export interface NumberingPlan {
	/** Country calling code, without `+`. */
	readonly callingCode: string;
	/** Possible lengths of the NSN, ascending. */
	readonly lengths: readonly number[];
	/** Lengths only dialable locally (without an area code): never a complete number. */
	readonly localLengths?: readonly number[];
	/** General pattern every NSN of the plan matches. */
	readonly pattern: string;
	/** National (trunk) prefix: `0` in France, `1` in North America, `8` in Russia. */
	readonly nationalPrefix?: string;
	/** Pattern of the national prefix when reading, if it is not just `nationalPrefix`. */
	readonly nationalPrefixForParsing?: string;
	/** Rewrite of a matched national prefix (`268$1`: a local number gets its area code). */
	readonly nationalPrefixTransformRule?: string;
	/** Formats, in priority order; absent for a territory rendered with its calling code's main territory. */
	readonly formats?: readonly PlanFormat[];
}
