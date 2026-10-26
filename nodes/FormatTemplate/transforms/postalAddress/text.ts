/**
 * Text helpers of the postal-address transformation
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/postalAddress/text
 *
 * @description
 * Two forms of a text are used throughout the transformation:
 *
 * - the **postal form** — uppercase, no punctuation, single spaces, accents
 *   removed on demand — which is what the French address standard asks for
 *   from line 4 onwards (NF Z10-011, La Poste guide SP8855 §3.1);
 * - the **comparison tokens** — the postal form without accents, split into
 *   words — used to compare an input with an answer of the geocoder.
 *
 * Pure module — no import of `n8n-workflow`.
 */

/** Ligatures and letters that canonical decomposition does not split. */
const LIGATURES: ReadonlyArray<readonly [RegExp, string]> = [
	[/œ/g, 'oe'],
	[/Œ/g, 'OE'],
	[/æ/g, 'ae'],
	[/Æ/g, 'AE'],
	[/ß/g, 'ss'],
];

/**
 * Removes diacritics and expands ligatures.
 *
 * @param text - Any text
 * @returns The text without combining marks: `Œuvre élevée` → `OEuvre elevee`
 *
 * @example
 * ```ts
 * stripDiacritics('Côte d’Ivoire'); // 'Cote d’Ivoire'
 * ```
 */
export function stripDiacritics(text: string): string {
	let result = text.normalize('NFD').replace(/\p{M}+/gu, '');
	for (const [pattern, replacement] of LIGATURES) result = result.replace(pattern, replacement);
	return result;
}

/**
 * Collapses whitespace and trims.
 *
 * @param text - Any text
 * @returns The text with single spaces
 */
export function collapseSpaces(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/**
 * Puts a text in postal form.
 *
 * @param text - Any text
 * @param stripAccents - Whether to remove diacritics
 * @returns Uppercase text, every non-letter non-digit character turned into a
 *          single space
 *
 * @remarks
 * The standard forbids punctuation from line 4 onwards: the apostrophe, the
 * hyphen, the period and the comma all become spaces (`L'ÉGLISE` → `L EGLISE`).
 *
 * @example
 * ```ts
 * toPostalForm("8 Boulevard du Port-d'Amont", true); // '8 BOULEVARD DU PORT D AMONT'
 * ```
 */
export function toPostalForm(text: string, stripAccents: boolean): string {
	const base = stripAccents ? stripDiacritics(text) : text;
	return base
		.toLocaleUpperCase('fr-FR')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/**
 * Splits a text into comparison tokens.
 *
 * @param text - Any text
 * @returns Uppercase words without accents or punctuation
 *
 * @example
 * ```ts
 * tokenize("Rue de l'Église"); // ['RUE', 'DE', 'L', 'EGLISE']
 * ```
 */
export function tokenize(text: string): string[] {
	const form = toPostalForm(text, true);
	return form === '' ? [] : form.split(' ');
}
