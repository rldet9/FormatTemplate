/**
 * Postal address — comparing an input with an answer (PA-S*)
 *
 * @module FormatTemplate/__tests__/postal-address-similarity
 */

import {
	cityKey,
	compareNames,
	compareStreets,
	editDistance,
	streetKey,
} from '../transforms/postalAddress/similarity';
import { stripDiacritics, toPostalForm, tokenize } from '../transforms/postalAddress/text';

describe('PA-S01 — postal form and tokens', () => {
	it('uppercases, removes punctuation, and removes accents on demand', () => {
		// Assert
		expect(toPostalForm("Rue de l'Église-Saint-Œuvre", true)).toBe('RUE DE L EGLISE SAINT OEUVRE');
		expect(toPostalForm("Rue de l'Église", false)).toBe('RUE DE L ÉGLISE');
	});

	it('expands ligatures that decomposition does not split', () => {
		// Assert
		expect(stripDiacritics('Œuvre, cæcum, Straße')).toBe('OEuvre, caecum, Strasse');
	});

	it('splits into words', () => {
		// Assert
		expect(tokenize('  Côte d’Ivoire  ')).toEqual(['COTE', 'D', 'IVOIRE']);
		expect(tokenize('')).toEqual([]);
	});
});

describe('PA-S02 — reading a street as (type, name)', () => {
	it.each([
		['bd du Port', { type: 'BOULEVARD', name: ['PORT'] }],
		['Rue du Faubourg Saint-Honoré', { type: 'RUE', name: ['FAUBOURG', 'SAINT', 'HONORE'] }],
		['r du fbg st honoré', { type: 'RUE', name: ['FAUBOURG', 'SAINT', 'HONORE'] }],
		['av du Gal de Gaulle', { type: 'AVENUE', name: ['GENERAL', 'GAULLE'] }],
		['ZI des Bas Prés', { type: 'ZONE INDUSTRIELLE', name: ['BAS', 'PRES'] }],
		['Rond-Point des Champs', { type: 'ROND POINT', name: ['CHAMPS'] }],
		['Grande Rue', { name: ['GRANDE', 'RUE'] }],
		['Port d’Amont', { name: ['PORT', 'AMONT'] }],
	])('reads "%s"', (text, key) => {
		// Assert
		expect(streetKey(text)).toEqual(key);
	});
});

describe('PA-S03 — comparing streets', () => {
	it.each([
		['bd du port', 'Boulevard du Port', 'exact'],
		['rue de la Pais', 'Rue de la Paix', 'fuzzy'],
		['place de Gaulle', 'Place du Général de Gaulle', 'partial'],
		['de la Paix', 'Rue de la Paix', 'exact'],
		['avenue du Général de Gaulle', 'Place du Général de Gaulle', 'different'],
		['bd du port', 'Port d’Amont', 'different'],
		['rue de la Paix Royale', 'Rue de la Paix', 'different'],
		['rue de Vaugirard', 'Rue de Brest', 'different'],
	])('"%s" vs "%s" → %s', (input, answer, agreement) => {
		// Assert
		expect(compareStreets(input, answer, 0.8).agreement).toBe(agreement);
	});

	it('flags a type the answer does not share', () => {
		// Assert — an avenue is not a square
		expect(compareStreets('avenue du Général de Gaulle', 'Place du Général de Gaulle', 0.8)).toMatchObject({
			typeConflict: true,
			similarity: 1,
		});
	});

	it('accepts an answer with a type when the input states none', () => {
		// Assert
		expect(compareStreets('de la Paix', 'Rue de la Paix', 0.8).typeConflict).toBe(false);
	});
});

describe('PA-S04 — comparing names', () => {
	it('tolerates one typo in a word of four letters or more, two from nine', () => {
		// Assert
		expect(compareNames(['PAIS'], ['PAIX'], 0.8).agreement).toBe('fuzzy');
		expect(compareNames(['RUE'], ['RUA'], 0.8).agreement).toBe('different');
		expect(compareNames(['VAUGIRRAD'], ['VAUGIRARD'], 0.8).agreement).toBe('fuzzy');
	});

	it('needs every typed word, and at most twice as many in the answer, for an omission', () => {
		// Assert
		expect(compareNames(['GAULLE'], ['GENERAL', 'GAULLE'], 0.8).agreement).toBe('partial');
		expect(compareNames(['GAULLE'], ['GENERAL', 'CHARLES', 'GAULLE'], 0.8).agreement).toBe('different');
	});

	it('measures edit distance', () => {
		// Assert
		expect(editDistance('PAIS', 'PAIX')).toBe(1);
		expect(editDistance('', 'ABC')).toBe(3);
		expect(editDistance('CHAT', 'CHAT')).toBe(0);
	});
});

describe('PA-S05 — municipality names', () => {
	it.each([
		['Paris 2e', ['PARIS']],
		['Paris 16ème Arrondissement', ['PARIS']],
		['St-Denis', ['SAINT', 'DENIS']],
		['Libourne Cedex', ['LIBOURNE']],
	])('reads "%s"', (text, key) => {
		// Assert
		expect(cityKey(text)).toEqual(key);
	});
});
