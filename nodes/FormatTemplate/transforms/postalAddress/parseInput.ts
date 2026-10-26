/**
 * Reading a postal address — restructuring the input before any lookup
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/postalAddress/parseInput
 *
 * @description
 * The first step of a postal check is to **restructure** the address: put each
 * piece of information where the French address standard expects it. People
 * type addresses on one line or several, with commas, flat numbers, building
 * names, post-office boxes and country names mixed in. Sent as is to a
 * geocoder, those extra words are noise; written back as is, they would be
 * lost.
 *
 * This module separates:
 *
 * - the **geographical address** — house number, repetition index, street,
 *   postcode, municipality — which is what the geocoder is asked about;
 * - the **complements** — inside the building (line 2: flat, floor,
 *   staircase) and outside it (line 3: entrance, building, residence) — kept
 *   for the output, never sent;
 * - the **special distribution** mentions (CEDEX, post-office box, mail
 *   sorting codes) — not a geographical address: the input is refused;
 * - the **country** — outside the territories of the national address base,
 *   the input is refused.
 *
 * Accepted inputs: a text (one line or several), an array of lines, or an
 * object with usual keys (`street`, `postcode`, `city`, `line1`…).
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { ftDiagnostic, FT_CODES, type FtDiagnostic } from '../../kernel/diagnostics';
import { COUNTRY_NAME_TO_ISO2, ISO2_CODES, normalizeCountryKey } from '../country/countryCodes';
import { ADDRESS_CODES } from './codes';
import { collapseSpaces, toPostalForm, tokenize } from './text';
import {
	DISTRIBUTION_KEYWORDS,
	DISTRIBUTION_PHRASES,
	INLINE_COMPLEMENT_KEYWORDS,
	LINE2_KEYWORDS,
	LINE3_KEYWORDS,
	REPETITION_INDICES,
	SUPPORTED_COUNTRIES,
} from './vocabulary';

/** An address restructured from the input. */
export interface ParsedAddress {
	/** Free-text query for the geocoder: the geographical address only. */
	query: string;
	/** House number, digits only (`8`). */
	housenumber?: string;
	/** Normalized repetition index (`BIS`, `TER`…, or a letter). */
	repetition?: string;
	/** Street, as written, without its number (`bd du Port`). */
	street?: string;
	/** Postcode (`80000`). */
	postcode?: string;
	/** Municipality, as written. */
	city?: string;
	/** Line 1 — the recipient, as written; never sent to the geocoder, never altered. */
	line1: string[];
	/** Line 2 complements, as written (`Appartement 12`). */
	line2: string[];
	/** Line 3 complements, as written (`Bâtiment B`). */
	line3: string[];
	/** Extra place names, as written (a hamlet). */
	localities: string[];
	/** ISO 3166-1 alpha-2 code, when the input names a country. */
	country?: string;
}

/** Result of reading an input. */
export type ParseResult =
	| { ok: true; address: ParsedAddress }
	| { ok: false; status: 'unchanged' | 'failed'; diagnostic: FtDiagnostic };

/** Input pieces before classification. */
interface RawPieces {
	segments: string[];
	postcode?: string;
	city?: string;
	country?: string;
}

/** Keys of an object input, normalized (lowercase, letters and digits only). */
const OBJECT_KEYS = {
	lines: ['lines', 'addresslines', 'lignes'],
	housenumber: ['housenumber', 'number', 'numero', 'num', 'streetnumber'],
	street: ['street', 'address', 'adresse', 'rue', 'voie', 'streetaddress'],
	postcode: ['postcode', 'postalcode', 'zip', 'zipcode', 'cp', 'codepostal'],
	city: ['city', 'locality', 'town', 'ville', 'commune'],
	country: ['country', 'countrycode', 'pays'],
} as const;

/** `line1`, `ligne2`, `address3`, `adresse_4`… */
const NUMBERED_LINE_KEY = /^(?:line|ligne|address|adresse|addressline)(\d)$/;

/** A postcode, optionally prefixed with `F-`, at the start of a segment. */
const LEADING_POSTCODE = /^(?:F-?)?(\d{5})(?:\s+(.*))?$/i;

/** A segment with a postcode after some text: `8 bd du Port 80000 Amiens`. */
const EMBEDDED_POSTCODE = /^(.*?\S)[\s,]+(?:F-?)?(\d{5})(?:\s+(.*))?$/i;

/**
 * A house number at the start of a street, with an optional range and
 * repetition index: `8`, `1 bis`, `1B`, `12-14`. `R` is not read as an index:
 * `5 r de la Paix` is "5 rue de la Paix".
 */
const HOUSE_NUMBER = /^\s*(\d{1,5})(?:\s*[-/]\s*\d{1,5})?\s*(bis|ter|quater|quinquies|[a-qs-z])?(?=[\s,]|$)[\s,]*(.*)$/i;

/** An ordinal followed by "étage": `2ème étage`, `1er étage`. */
const FLOOR = /^\d+\s*(?:E|EME|ER|ERE)\s+ETAGE\b/;

/**
 * Normalizes an object key.
 *
 * @param key - Key as written
 * @returns Lowercase key, letters and digits only
 */
function normalizeKey(key: string): string {
	return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Turns a scalar into trimmed text.
 *
 * @param value - Any value
 * @returns Text, or `undefined` for an empty or non-scalar value
 */
function asText(value: unknown): string | undefined {
	if (typeof value === 'string') return collapseSpaces(value) || undefined;
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return undefined;
}

/**
 * Collects the pieces of an object input.
 *
 * @param input - Object input
 * @returns Pieces, or `undefined` if no known key carries a value
 */
function piecesFromObject(input: Record<string, unknown>): RawPieces | undefined {
	const byKey = new Map<string, unknown>();
	for (const [key, value] of Object.entries(input)) byKey.set(normalizeKey(key), value);
	const first = (keys: readonly string[]) =>
		keys.map((key) => asText(byKey.get(key))).find((value) => value !== undefined);

	const segments: string[] = [];
	for (const key of OBJECT_KEYS.lines) {
		const lines = byKey.get(key);
		if (Array.isArray(lines)) segments.push(...lines.map(asText).filter((line): line is string => !!line));
	}
	const numbered = [...byKey.entries()]
		.map(([key, value]) => ({ match: NUMBERED_LINE_KEY.exec(key), value: asText(value) }))
		.filter((entry) => entry.match && entry.value)
		.sort((a, b) => Number(a.match?.[1]) - Number(b.match?.[1]));
	segments.push(...numbered.map((entry) => entry.value as string));

	const street = first(OBJECT_KEYS.street);
	const housenumber = first(OBJECT_KEYS.housenumber);
	if (street) segments.push(housenumber && !/^\d/.test(street) ? `${housenumber} ${street}` : street);

	const pieces: RawPieces = {
		segments,
		postcode: first(OBJECT_KEYS.postcode),
		city: first(OBJECT_KEYS.city),
		country: first(OBJECT_KEYS.country),
	};
	const known = segments.length > 0 || pieces.postcode || pieces.city;
	return known ? pieces : undefined;
}

/**
 * Splits a text input into segments: one per line, comma or semicolon.
 *
 * @param text - Text input
 * @returns Pieces
 */
function piecesFromText(text: string): RawPieces {
	return {
		segments: text
			.split(/\r?\n|[,;]/)
			.map(collapseSpaces)
			.filter((segment) => segment !== ''),
	};
}

/**
 * Resolves a country designation, if the text is one.
 *
 * @param text - Candidate text
 * @returns ISO 3166-1 alpha-2 code, or `undefined`
 */
function countryOf(text: string): string | undefined {
	const trimmed = text.trim();
	if (/^[a-z]{2}$/i.test(trimmed) && ISO2_CODES.has(trimmed.toUpperCase())) return trimmed.toUpperCase();
	return COUNTRY_NAME_TO_ISO2[normalizeCountryKey(trimmed)];
}

/**
 * Tells whether a segment is a special distribution mention.
 *
 * @param segment - Segment as written
 * @returns `true` for a CEDEX, post-office box or mail sorting mention
 */
function isDistribution(segment: string): boolean {
	const tokens = tokenize(segment);
	const form = tokens.join(' ');
	return (
		tokens.some((token) => DISTRIBUTION_KEYWORDS.has(token) && (token === 'CEDEX' || tokens[0] === token)) ||
		DISTRIBUTION_PHRASES.some((phrase) => form.includes(phrase))
	);
}

/**
 * Classifies a segment that is neither a postcode line nor a country.
 *
 * @param segment - Segment as written
 * @returns Where it belongs
 */
function classify(segment: string): 'line2' | 'line3' | 'street' {
	if (/^\s*\d/.test(segment) && !FLOOR.test(toPostalForm(segment, true))) return 'street';
	const tokens = tokenize(segment);
	// The first word decides: a hamlet called "La Porte" is not a door number.
	if (FLOOR.test(tokens.join(' ')) || LINE2_KEYWORDS.has(tokens[0] ?? '')) return 'line2';
	if (LINE3_KEYWORDS.has(tokens[0] ?? '')) return 'line3';
	return 'street';
}

/**
 * Splits a complement typed at the end of a street line.
 *
 * @param street - Street segment as written
 * @returns The street, and the trailing complement if there is one
 *
 * @example
 * ```ts
 * splitInlineComplement('10 rue de la Paix appt 12');
 * // { street: '10 rue de la Paix', complement: 'appt 12' }
 * ```
 */
function splitInlineComplement(street: string): { street: string; complement?: string } {
	const words = street.split(' ');
	for (let index = 2; index < words.length; index++) {
		if (INLINE_COMPLEMENT_KEYWORDS.has(toPostalForm(words[index], true))) {
			return { street: words.slice(0, index).join(' '), complement: words.slice(index).join(' ') };
		}
	}
	return { street };
}

/**
 * Builds a refusal.
 *
 * @param code - Diagnostic code
 * @param message - Message, without the value
 * @returns Failed result
 */
function refuse(code: string, message: string): ParseResult {
	return { ok: false, status: 'failed', diagnostic: ftDiagnostic(code, message) };
}

/**
 * Reads and restructures a postal address.
 *
 * @param value - Value read from the item, unconverted
 * @returns The restructured address, or why it cannot be checked
 *
 * @example
 * ```ts
 * parseAddressInput('Appartement 12\n8 bd du Port\n80000 Amiens');
 * // { ok: true, address: { query: '8 bd du Port 80000 Amiens', housenumber: '8',
 * //   street: 'bd du Port', postcode: '80000', city: 'Amiens',
 * //   line1: [], line2: ['Appartement 12'], line3: [], localities: [] } }
 *
 * parseAddressInput('BP 18 33506 Libourne Cedex');
 * // { ok: false, status: 'failed', diagnostic: FT_ADDRESS_SPECIAL_DISTRIBUTION }
 * ```
 */
export function parseAddressInput(value: unknown): ParseResult {
	let pieces: RawPieces | undefined;
	if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
		return {
			ok: false,
			status: 'unchanged',
			diagnostic: ftDiagnostic(FT_CODES.VALUE_EMPTY, 'Empty value: no address to check.', {
				severity: 'info',
			}),
		};
	}
	if (typeof value === 'string') pieces = piecesFromText(value);
	else if (Array.isArray(value)) {
		pieces = { segments: value.map(asText).filter((line): line is string => !!line) };
	} else if (typeof value === 'object') pieces = piecesFromObject(value as Record<string, unknown>);

	if (!pieces) {
		return refuse(
			ADDRESS_CODES.INPUT_UNREADABLE,
			'The value is neither an address text nor an object with known address keys.',
		);
	}

	// --- Country: an explicit key, or a last segment that names one -------------
	let country = pieces.country ? countryOf(pieces.country) ?? pieces.country.toUpperCase() : undefined;
	const segments = [...pieces.segments];
	if (!country && segments.length > 1 && !/^\s*\d/.test(segments[segments.length - 1])) {
		const named = countryOf(segments[segments.length - 1]);
		if (named) {
			country = named;
			segments.pop();
		}
	}
	if (country && !SUPPORTED_COUNTRIES.has(country)) {
		return refuse(
			ADDRESS_CODES.COUNTRY_UNSUPPORTED,
			'The address is outside the territories covered by the French national address base.',
		);
	}

	// --- Postcode line: from the object keys, or the last segment carrying one ----
	let { postcode, city } = pieces;
	const remaining: string[] = [];
	for (const segment of segments) {
		const embedded = EMBEDDED_POSTCODE.exec(segment);
		const leading = LEADING_POSTCODE.exec(segment);
		if (leading) {
			postcode = leading[1];
			city = leading[2] ? collapseSpaces(leading[2]) : city;
		} else if (embedded && !/^\s*\d{1,5}\s*$/.test(embedded[1])) {
			remaining.push(embedded[1]);
			postcode = embedded[2];
			city = embedded[3] ? collapseSpaces(embedded[3]) : city;
		} else {
			remaining.push(segment);
		}
	}

	// --- Special distribution: CEDEX, BP, CS, TSA -------------------------------
	if ((city && isDistribution(city)) || remaining.some(isDistribution)) {
		return refuse(
			ADDRESS_CODES.SPECIAL_DISTRIBUTION,
			'The address carries a special distribution mention (CEDEX, post-office box or mail ' +
				'sorting code): it is not a geographical address the national base can check.',
		);
	}

	// --- Complements and street ---------------------------------------------------
	const line2: string[] = [];
	const line3: string[] = [];
	const streets: string[] = [];
	for (const segment of remaining) {
		const kind = classify(segment);
		if (kind === 'line2') line2.push(segment);
		else if (kind === 'line3') line3.push(segment);
		else streets.push(segment);
	}
	// The street line is the first one with a house number, else the first one. The
	// standard orders an address from the recipient to the municipality: what comes
	// before the street line is the recipient (line 1), what comes after it is a
	// place name (line 5).
	let streetIndex = streets.findIndex((segment) => /^\s*\d/.test(segment));
	if (streetIndex < 0) streetIndex = streets.length > 1 ? streets.length - 1 : 0;
	let streetLine: string | undefined = streets[streetIndex];
	if (!streetLine && line3.length > 0) streetLine = line3.pop();
	const line1 = streets.slice(0, Math.max(streetIndex, 0));
	const localities = streets.slice(streetIndex + 1);

	if (!streetLine) {
		return refuse(
			ADDRESS_CODES.INPUT_UNREADABLE,
			'No street or place name to check: a postcode or a municipality alone is not an address.',
		);
	}

	const inline = splitInlineComplement(streetLine);
	if (inline.complement) {
		(tokenize(inline.complement).some((token) => LINE2_KEYWORDS.has(token)) ? line2 : line3).push(
			inline.complement,
		);
	}

	const numbered = HOUSE_NUMBER.exec(inline.street);
	const housenumber = numbered ? String(Number(numbered[1])) : undefined;
	const repetition = numbered?.[2]
		? REPETITION_INDICES[numbered[2].toUpperCase()] ?? numbered[2].toUpperCase()
		: undefined;
	const street = numbered ? collapseSpaces(numbered[3]) || undefined : inline.street;

	if (!street) {
		return refuse(ADDRESS_CODES.INPUT_UNREADABLE, 'A house number without a street cannot be checked.');
	}

	const query = collapseSpaces(
		[
			housenumber ? `${housenumber}${repetition ? ` ${repetition.toLowerCase()}` : ''}` : '',
			street,
			...localities,
			postcode ?? '',
			city ?? '',
		].join(' '),
	);

	return {
		ok: true,
		address: {
			query,
			...(housenumber ? { housenumber } : {}),
			...(repetition ? { repetition } : {}),
			street,
			...(postcode ? { postcode } : {}),
			...(city ? { city } : {}),
			line1,
			line2,
			line3,
			localities,
			...(country ? { country } : {}),
		},
	};
}
