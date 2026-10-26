/**
 * Postal address — lines to the French standard (PA-L*)
 *
 * @module FormatTemplate/__tests__/postal-address-lines
 *
 * @description
 * NF Z10-011, as published by La Poste (guide SP8855 volume 2, §3): 38
 * characters at most per line, uppercase and no punctuation from line 4,
 * no blank line, and only the official abbreviations (ADR-0014).
 */

import type { AddressCandidate } from '../ports/geocoder';
import { ADDRESS_CODES } from '../transforms/postalAddress/codes';
import { parseAddressInput, type ParsedAddress } from '../transforms/postalAddress/parseInput';
import { buildPostalLines, MAX_LINE_LENGTH } from '../transforms/postalAddress/postalLines';
import { OFFICIAL_ABBREVIATIONS } from '../transforms/postalAddress/vocabulary';

/**
 * Parses an input that must be readable.
 *
 * @param value - Input
 * @returns The restructured address
 */
function parsed(value: unknown): ParsedAddress {
	const result = parseAddressInput(value);
	if (!result.ok) throw new Error(`refused: ${result.diagnostic.code}`);
	return result.address;
}

const OPTIONS = { stripAccents: true, includeCountryLine: false };

/**
 * Builds the lines of an answer for a plain input.
 *
 * @param fields - The answer
 * @param options - Formatting options
 * @returns Line texts
 */
function linesOf(fields: Partial<AddressCandidate>, options = OPTIONS): string[] {
	const answer: AddressCandidate = { label: '', score: 1, precision: 'housenumber', ...fields };
	return buildPostalLines(parsed('1 rue X 75001 Paris'), answer, options).lines.map((line) => line.text);
}

describe('PA-L01 — composition', () => {
	it('numbers the lines as the standard does and drops the empty ones', () => {
		// Act
		const { lines } = buildPostalLines(
			parsed('Mme Durand\nAppartement 12\nBâtiment B\n10 rue de la Paix\n75002 Paris'),
			{ label: '', score: 1, precision: 'housenumber', housenumber: '10', street: 'Rue de la Paix', postcode: '75002', city: 'Paris' },
			OPTIONS,
		);

		// Assert
		expect(lines).toEqual([
			{ number: 1, text: 'Mme Durand' },
			{ number: 2, text: 'Appartement 12' },
			{ number: 3, text: 'Bâtiment B' },
			{ number: 4, text: '10 RUE DE LA PAIX' },
			{ number: 6, text: '75002 PARIS' },
		]);
	});

	it('writes the former municipality on line 5, only when it differs', () => {
		// Assert
		expect(
			linesOf({ precision: 'street', street: 'Place Napoleon', postcode: '50100', city: 'Cherbourg-en-Cotentin', oldCity: 'Cherbourg-Octeville' }),
		).toEqual(['PLACE NAPOLEON', 'CHERBOURG OCTEVILLE', '50100 CHERBOURG EN COTENTIN']);
		expect(linesOf({ street: 'Place du Général de Gaulle', postcode: '59800', city: 'Lille', oldCity: 'Lille' })).toEqual([
			'PLACE DU GENERAL DE GAULLE',
			'59800 LILLE',
		]);
	});

	it('adds FRANCE as line 7 on demand', () => {
		// Assert
		expect(
			linesOf({ housenumber: '1', street: 'Rue X', postcode: '75001', city: 'Paris' }, { ...OPTIONS, includeCountryLine: true }),
		).toEqual(['1 RUE X', '75001 PARIS', 'FRANCE']);
	});

	it('writes the repetition index apart from the number', () => {
		// Assert
		expect(linesOf({ housenumber: '1B', street: 'Rue des Carmes', postcode: '75005', city: 'Paris' })[0]).toBe(
			'1 B RUE DES CARMES',
		);
	});
});

describe('PA-L02 — uppercase, no punctuation, accents on demand', () => {
	it('writes lines 4 to 6 in uppercase, without punctuation or accents', () => {
		// Assert
		expect(
			linesOf({ housenumber: '126', street: "Rue de l'Université", postcode: '75007', city: 'Paris' }),
		).toEqual(['126 RUE DE L UNIVERSITE', '75007 PARIS']);
	});

	it('keeps the accents when asked to', () => {
		// Assert
		expect(
			linesOf({ housenumber: '126', street: "Rue de l'Université", postcode: '75007', city: 'Paris' }, {
				...OPTIONS,
				stripAccents: false,
			})[0],
		).toBe('126 RUE DE L UNIVERSITÉ');
	});

	it('keeps lines 1 to 3 as written', () => {
		// Assert
		expect(
			buildPostalLines(parsed('Chez M. Durand-Lévy\n1 rue X\n75001 Paris'), { label: '', score: 1, precision: 'street', street: 'Rue X', postcode: '75001', city: 'Paris' }, OPTIONS).lines[0].text,
		).toBe('Chez M. Durand-Lévy');
	});
});

describe('PA-L03 — 38 characters, official abbreviations only, never truncated', () => {
	it('leaves a line that fits unabbreviated', () => {
		// Assert — the standard only allows abbreviating a line that does not fit
		expect(linesOf({ housenumber: '8', street: 'Boulevard du Port', postcode: '80000', city: 'Amiens' })[0]).toBe(
			'8 BOULEVARD DU PORT',
		);
	});

	it('abbreviates the street type of a line over 38 characters', () => {
		// Act — "1 PLACE DU MARECHAL DE LATTRE DE TASSIGNY" has 41 characters
		const lines = linesOf({ housenumber: '1', street: 'Place du Maréchal de Lattre de Tassigny', postcode: '75116', city: 'Paris' });

		// Assert
		expect(lines[0]).toBe('1 PL DU MARECHAL DE LATTRE DE TASSIGNY');
		expect(lines[0].length).toBeLessThanOrEqual(MAX_LINE_LENGTH);
	});

	it('prefers the longest official type: CENTRE COMMERCIAL, not CENTRE', () => {
		// Assert
		expect(
			linesOf({ housenumber: '12', street: 'Centre Commercial des Grands Champs Élysées', postcode: '75008', city: 'Paris' })[0],
		).toBe('12 CCAL DES GRANDS CHAMPS ELYSEES');
	});

	it('reports a line still too long, and keeps it whole', () => {
		// Act — "MARECHAL" is not on the official list: it is never abbreviated
		const result = buildPostalLines(
			parsed('10 avenue X 92100 Boulogne-Billancourt'),
			{ label: '', score: 1, precision: 'housenumber', housenumber: '10', street: 'Avenue du Maréchal de Lattre de Tassigny', postcode: '92100', city: 'Boulogne-Billancourt' },
			OPTIONS,
		);

		// Assert
		expect(result.lines.find((line) => line.number === 4)?.text).toBe('10 AV DU MARECHAL DE LATTRE DE TASSIGNY');
		expect(result.diagnostics).toEqual([
			expect.objectContaining({ code: ADDRESS_CODES.LINE_TOO_LONG, severity: 'warning' }),
		]);
		expect(result.diagnostics[0].message).toMatch(/^Line 4 has 39 characters/);
	});

	it('uses the twenty abbreviations of the published list, and no other', () => {
		// Assert — La Poste guide SP8855 volume 2, §3.3
		expect(new Set(Object.values(OFFICIAL_ABBREVIATIONS))).toEqual(
			new Set(['ALL', 'AV', 'BD', 'CTRE', 'CCAL', 'IMM', 'IMP', 'LD', 'LOT', 'PAS', 'PL', 'RES', 'RPT', 'RTE', 'SQ', 'VLGE', 'ZA', 'ZAC', 'ZAD', 'ZI']),
		);
	});
});
