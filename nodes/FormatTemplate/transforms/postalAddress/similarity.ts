/**
 * Comparing an input with a geocoder answer
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/postalAddress/similarity
 *
 * @description
 * A geocoder ranks answers by a relevance score, and the score alone cannot
 * tell a right answer from a wrong one: measured on the national base on
 * 2026-10-25, a correct address written with abbreviations scored 0.656 while
 * a wrong one — another street, another postcode — scored 0.632 (ADR-0013).
 * The verdict therefore **compares** the answer with what the user wrote.
 *
 * A street is compared as a pair (type, name):
 *
 * - the **type** (`RUE`, `AVENUE`, `PLACE`…) is read from the leading words,
 *   through the aliases people type (`bd`, `av`, `r`). When the input states a
 *   type, the answer must have the same one: an avenue is not a square;
 * - the **name** is compared word by word, stop words removed, abbreviations
 *   expanded (`st` → `SAINT`), one typo tolerated per word of four letters or
 *   more. Every word the user typed must be found, the official name may hold
 *   more (`place de Gaulle` → `Place du Général de Gaulle`).
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { tokenize } from './text';
import { STOP_WORDS, STREET_TYPES, WORD_ALIASES } from './vocabulary';

/** How two names agree. */
export type Agreement = 'exact' | 'fuzzy' | 'partial' | 'different';

/** A street read as (type, name). */
export interface StreetKey {
	/** Canonical street type, when the text starts with one. */
	type?: string;
	/** Significant words of the name. */
	name: string[];
}

/** Result of comparing two streets. */
export interface StreetComparison {
	agreement: Agreement;
	/** The input states a street type the answer does not have. */
	typeConflict: boolean;
	/** Dice coefficient of the names, between 0 and 1. */
	similarity: number;
}

/** Street type of every alias and canonical form, in postal form. */
const TYPE_BY_FORM: ReadonlyMap<string, string> = new Map(
	Object.entries(STREET_TYPES).flatMap(([canonical, aliases]) => [
		[canonical, canonical] as const,
		...aliases.map((alias) => [alias, canonical] as const),
	]),
);

/** Longest street type, in words (`ZONE D AMENAGEMENT CONCERTE`). */
const MAX_TYPE_WORDS = Math.max(...[...TYPE_BY_FORM.keys()].map((form) => form.split(' ').length));

/**
 * Street-type abbreviations that are safe to expand **inside** a name
 * (`rue du fbg Saint-Honoré`). Short or ambiguous ones are left out: `R`, `CH`,
 * `PAS` (Pas-de-Calais), `LOT` (the river), `RES`.
 */
const NAME_TYPE_ALIASES: Readonly<Record<string, string>> = {
	FBG: 'FAUBOURG',
	FG: 'FAUBOURG',
	BD: 'BOULEVARD',
	BLD: 'BOULEVARD',
	BVD: 'BOULEVARD',
	AV: 'AVENUE',
	AVE: 'AVENUE',
	PL: 'PLACE',
	RTE: 'ROUTE',
	CHEM: 'CHEMIN',
	IMP: 'IMPASSE',
	SQ: 'SQUARE',
	PROM: 'PROMENADE',
	ESPL: 'ESPLANADE',
};

/** Arrondissement and distribution noise in a municipality name: `2E`, `1ER`, `ARRONDISSEMENT`. */
const CITY_NOISE = /^(?:\d+(?:E|EME|ER|ERE)?|ARRONDISSEMENT|ARR|CEDEX)$/;

/**
 * Expands abbreviations and drops stop words.
 *
 * @param tokens - Comparison tokens
 * @returns Significant words
 */
function significant(tokens: readonly string[]): string[] {
	return tokens
		.flatMap((token) => (WORD_ALIASES[token] ?? NAME_TYPE_ALIASES[token] ?? token).split(' '))
		.filter((token) => !STOP_WORDS.has(token));
}

/**
 * Reads a street as (type, name).
 *
 * @param text - Street as written, without its number
 * @returns Street key
 *
 * @example
 * ```ts
 * streetKey('bd du Port');               // { type: 'BOULEVARD', name: ['PORT'] }
 * streetKey('Rue du Faubourg Saint-Honoré'); // { type: 'RUE', name: ['FAUBOURG', 'SAINT', 'HONORE'] }
 * streetKey('Grande Rue');               // { name: ['GRANDE', 'RUE'] }
 * ```
 */
export function streetKey(text: string): StreetKey {
	const tokens = tokenize(text);
	for (let words = Math.min(MAX_TYPE_WORDS, tokens.length - 1); words >= 1; words--) {
		const type = TYPE_BY_FORM.get(tokens.slice(0, words).join(' '));
		if (type) return { type, name: significant(tokens.slice(words)) };
	}
	return { name: significant(tokens) };
}

/**
 * Reads a municipality name for comparison.
 *
 * @param text - Municipality as written
 * @returns Significant words, arrondissement and CEDEX noise removed
 *
 * @example
 * ```ts
 * cityKey('Paris 2e');     // ['PARIS']
 * cityKey('St-Denis');     // ['SAINT', 'DENIS']
 * ```
 */
export function cityKey(text: string): string[] {
	return significant(tokenize(text)).filter((token) => !CITY_NOISE.test(token));
}

/**
 * Edit distance between two words (Levenshtein).
 *
 * @param a - First word
 * @param b - Second word
 * @returns Number of single-character edits
 */
export function editDistance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			current[j] = Math.min(
				previous[j] + 1,
				current[j - 1] + 1,
				previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		}
		previous = current;
	}
	return previous[b.length];
}

/**
 * Tells whether two words are the same up to a typo.
 *
 * @param a - First word
 * @param b - Second word
 * @returns `exact`, `fuzzy` (one edit for words of 4+ letters, two for 9+), or `undefined`
 */
function wordAgreement(a: string, b: string): 'exact' | 'fuzzy' | undefined {
	if (a === b) return 'exact';
	const shortest = Math.min(a.length, b.length);
	if (shortest < 4) return undefined;
	return editDistance(a, b) <= (shortest >= 9 ? 2 : 1) ? 'fuzzy' : undefined;
}

/**
 * Compares two lists of significant words.
 *
 * @param input - Words of the input
 * @param answer - Words of the answer
 * @param minimumSimilarity - Dice coefficient below which the names differ
 * @returns Agreement and Dice coefficient
 *
 * @remarks
 * - `exact`: the same words;
 * - `fuzzy`: the same words, up to typos;
 * - `partial`: every input word is found and the answer holds at most twice as
 *   many, or the Dice coefficient reaches `minimumSimilarity` — a correction;
 * - `different`: anything else.
 */
export function compareNames(
	input: readonly string[],
	answer: readonly string[],
	minimumSimilarity: number,
): { agreement: Agreement; similarity: number } {
	if (input.length === 0 && answer.length === 0) return { agreement: 'exact', similarity: 1 };
	if (input.length === 0 || answer.length === 0) return { agreement: 'different', similarity: 0 };

	const unused = [...answer];
	let matched = 0;
	let fuzzy = false;
	for (const word of input) {
		let index = unused.indexOf(word);
		if (index < 0) {
			index = unused.findIndex((candidate) => wordAgreement(word, candidate) === 'fuzzy');
			if (index >= 0) fuzzy = true;
		}
		if (index >= 0) {
			matched++;
			unused.splice(index, 1);
		}
	}

	const similarity = (2 * matched) / (input.length + answer.length);
	if (matched === input.length && matched === answer.length) {
		return { agreement: fuzzy ? 'fuzzy' : 'exact', similarity };
	}
	const contained = matched === input.length && matched / answer.length >= 0.5;
	return { agreement: contained || similarity >= minimumSimilarity ? 'partial' : 'different', similarity };
}

/**
 * Compares a street of the input with a street of an answer.
 *
 * @param input - Street of the input, as written
 * @param answer - Street of the answer, as written
 * @param minimumSimilarity - Dice coefficient below which the names differ
 * @returns Comparison
 *
 * @example
 * ```ts
 * compareStreets('bd du port', 'Boulevard du Port', 0.8);   // exact
 * compareStreets('rue de la Pais', 'Rue de la Paix', 0.8);  // fuzzy
 * compareStreets('avenue du Général de Gaulle', 'Place du Général de Gaulle', 0.8);
 * // different — typeConflict
 * ```
 */
export function compareStreets(
	input: string,
	answer: string,
	minimumSimilarity: number,
): StreetComparison {
	const inputKey = streetKey(input);
	const answerKey = streetKey(answer);
	const names = compareNames(inputKey.name, answerKey.name, minimumSimilarity);
	const typeConflict = inputKey.type !== undefined && inputKey.type !== answerKey.type;
	return {
		agreement: typeConflict ? 'different' : names.agreement,
		typeConflict,
		similarity: names.similarity,
	};
}
