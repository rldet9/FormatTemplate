/**
 * Matching the patterns of the numbering plans
 *
 * @version 2.0.0
 * @module FormatTemplate/transforms/phone/patterns
 *
 * @description
 * The generated plans hold patterns as source strings. They are compiled on
 * first use and kept: the table is fixed, so the cache is bounded by its size
 * (a few thousand patterns at most), and a given pattern always gives the same
 * answer — the functions below stay pure from the caller's point of view.
 *
 * The patterns come from libphonenumber, written for Java. Those the table
 * holds use no construct JavaScript reads differently; the generator compiles
 * each of them and the corpus test compares the readings with the examples of
 * every plan.
 *
 * Pure module — no import of `n8n-workflow`.
 */

/** Compiled patterns, by anchoring and source. */
const compiled = new Map<string, RegExp>();

/**
 * Compiles a pattern once.
 *
 * @param source - Pattern source
 * @param whole - `true`: anchored at both ends; `false`: at the start only
 * @returns Compiled expression
 */
function compile(source: string, whole: boolean): RegExp {
	const key = `${whole ? 'W' : 'S'}${source}`;
	let expression = compiled.get(key);
	if (!expression) {
		expression = new RegExp(whole ? `^(?:${source})$` : `^(?:${source})`);
		compiled.set(key, expression);
	}
	return expression;
}

/**
 * Tells whether the pattern matches the whole string — libphonenumber's `matches()`.
 *
 * @param source - Pattern source
 * @param digits - Digits to test
 * @returns `true` on a full match
 *
 * @example
 * ```ts
 * matchesWhole('[1-9]\\d{8}', '320000000'); // true
 * ```
 */
export function matchesWhole(source: string, digits: string): boolean {
	return compile(source, true).test(digits);
}

/**
 * Matches the pattern at the start of the string — libphonenumber's `lookingAt()`.
 *
 * @param source - Pattern source
 * @param digits - Digits to test
 * @returns Match with its groups, or `null`
 *
 * @example
 * ```ts
 * matchAtStart('0|180020', '0320000000')?.[0]; // '0'
 * ```
 */
export function matchAtStart(source: string, digits: string): RegExpExecArray | null {
	return compile(source, false).exec(digits);
}

/**
 * Rewrites the string through a template, on a full match — group references `$1`…`$9`.
 *
 * @param source - Pattern source, with capturing groups
 * @param digits - Digits matched as a whole
 * @param template - Replacement template (`$1 $2 $3`)
 * @returns Rewritten string
 *
 * @example
 * ```ts
 * replaceWhole('(\\d{2})(\\d{4})', '201234', '$1-$2'); // '20-1234'
 * ```
 */
export function replaceWhole(source: string, digits: string, template: string): string {
	return digits.replace(compile(source, true), template);
}

/**
 * Rewrites the start of the string through a template — libphonenumber's `replaceFirst()`.
 *
 * @param source - Pattern source, with capturing groups
 * @param digits - Digits whose start matches
 * @param template - Replacement template (`268$1`)
 * @returns Rewritten string, the unmatched rest kept
 */
export function replaceAtStart(source: string, digits: string, template: string): string {
	return digits.replace(compile(source, false), template);
}
