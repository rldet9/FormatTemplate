/**
 * Postal address — reading the input (PA-P*)
 *
 * @module FormatTemplate/__tests__/postal-address-parse
 *
 * @description
 * Restructuring an address before any lookup: what goes to the geocoder, what
 * is kept for the output, what is refused.
 */

import { FT_CODES } from '../kernel/diagnostics';
import { ADDRESS_CODES } from '../transforms/postalAddress/codes';
import { parseAddressInput, type ParsedAddress } from '../transforms/postalAddress/parseInput';

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

/**
 * Parses an input that must be refused.
 *
 * @param value - Input
 * @returns The refusal's code and status
 */
function refused(value: unknown): { code: string; status: string } {
	const result = parseAddressInput(value);
	if (result.ok) throw new Error('accepted');
	return { code: result.diagnostic.code, status: result.status };
}

describe('PA-P01 — a single line', () => {
	it('splits number, street, postcode and municipality', () => {
		// Assert
		expect(parsed('8 bd du Port 80000 Amiens')).toMatchObject({
			query: '8 bd du Port 80000 Amiens',
			housenumber: '8',
			street: 'bd du Port',
			postcode: '80000',
			city: 'Amiens',
		});
	});

	it('keeps a street without postcode whole: the municipality is told apart later', () => {
		// Assert
		expect(parsed('8 bd du port amiens')).toMatchObject({ street: 'bd du port amiens' });
		expect(parsed('8 bd du port amiens').postcode).toBeUndefined();
	});

	it('reads a postcode written with the F- prefix', () => {
		// Assert
		expect(parsed('12 rue de la Paix, F-75002 Paris')).toMatchObject({ postcode: '75002', city: 'Paris' });
	});

	it('does not read a year as a postcode', () => {
		// Assert
		expect(parsed('3 rue du 8 Mai 1945 75010 Paris')).toMatchObject({
			street: 'rue du 8 Mai 1945',
			postcode: '75010',
		});
	});
});

describe('PA-P02 — house number and repetition index', () => {
	it.each([
		['1 bis rue des Écoles', '1', 'BIS'],
		['1B rue des Carmes', '1', 'BIS'],
		['3 ter rue X', '3', 'TER'],
		['7 A rue X', '7', 'A'],
		['08 rue X', '8', undefined],
	])('reads "%s" as %s %s', (input, housenumber, repetition) => {
		// Act
		const address = parsed(`${input} 75005 Paris`);

		// Assert
		expect(address.housenumber).toBe(housenumber);
		expect(address.repetition).toBe(repetition);
	});

	it('does not read "r" as a repetition index: it is "rue"', () => {
		// Assert
		expect(parsed('5 r de la Paix 75002 Paris')).toMatchObject({ housenumber: '5', street: 'r de la Paix' });
		expect(parsed('5 r de la Paix 75002 Paris').repetition).toBeUndefined();
	});

	it('keeps the first number of a range', () => {
		// Assert
		expect(parsed('12-14 rue de la Paix 75002 Paris')).toMatchObject({ housenumber: '12', street: 'rue de la Paix' });
	});
});

describe('PA-P03 — lines of the standard are kept, never sent', () => {
	it('keeps the recipient on line 1 and the complements on lines 2 and 3', () => {
		// Act
		const address = parsed('Mme Durand\nAppartement 12\nBâtiment B\n10 rue de la Paix\n75002 Paris');

		// Assert
		expect(address).toMatchObject({
			query: '10 rue de la Paix 75002 Paris',
			line1: ['Mme Durand'],
			line2: ['Appartement 12'],
			line3: ['Bâtiment B'],
		});
	});

	it('reads a floor written as an ordinal as line 2', () => {
		// Assert
		expect(parsed('2ème étage\n10 rue de la Paix\n75002 Paris').line2).toEqual(['2ème étage']);
	});

	it('splits a complement typed at the end of the street line', () => {
		// Assert
		expect(parsed('10 rue de la Paix appt 12, 75002 Paris')).toMatchObject({
			street: 'rue de la Paix',
			line2: ['appt 12'],
		});
	});

	it('does not take a hamlet called "La Porte" for a door number', () => {
		// Act
		const address = parsed('12 rue de l’Église\nLa Porte\n33380 Mios');

		// Assert — the first word decides, and "La" is not a keyword
		expect(address.line2).toEqual([]);
		expect(address.localities).toEqual(['La Porte']);
	});

	it('keeps a place name after the street as a locality, and sends it', () => {
		// Assert
		expect(parsed('25 rue de l’Église\nCaudos\n33380 Mios')).toMatchObject({
			localities: ['Caudos'],
			query: '25 rue de l’Église Caudos 33380 Mios',
		});
	});

	it('promotes a residence to the street when nothing else names one', () => {
		// Assert
		expect(parsed('Résidence Les Pins\n33000 Bordeaux')).toMatchObject({ street: 'Résidence Les Pins', line3: [] });
	});
});

describe('PA-P04 — objects and arrays', () => {
	it('reads usual keys, case and separators ignored', () => {
		// Assert
		expect(
			parsed({ Street: '126 rue de l’Université', postal_code: '75007', City: 'Paris', Country: 'FR' }),
		).toMatchObject({
			housenumber: '126',
			street: 'rue de l’Université',
			postcode: '75007',
			city: 'Paris',
			country: 'FR',
		});
	});

	it('joins a separate house number to the street', () => {
		// Assert
		expect(parsed({ number: 8, street: 'boulevard du Port', zip: '80000', town: 'Amiens' })).toMatchObject({
			housenumber: '8',
			street: 'boulevard du Port',
		});
	});

	it('reads numbered lines in their order', () => {
		// Assert
		expect(parsed({ line2: '75002 Paris', line1: '12 rue de la Paix' })).toMatchObject({
			housenumber: '12',
			postcode: '75002',
		});
	});

	it('reads an array as lines', () => {
		// Assert
		expect(parsed(['12 rue de la Paix', '75002 Paris'])).toMatchObject({ housenumber: '12', city: 'Paris' });
	});
});

describe('PA-P05 — country', () => {
	it.each(['France', 'FR', 'Réunion'])('drops a trailing "%s" from the query', (country) => {
		// Assert
		expect(parsed(`12 rue de la Paix, 75002 Paris, ${country}`).query).toBe('12 rue de la Paix 75002 Paris');
	});

	it.each([
		['10 Downing Street, London, United Kingdom'],
		[{ street: '1600 Pennsylvania Avenue NW', city: 'Washington', country: 'US' }],
		[{ street: 'Rue de la Loi 16', postcode: '1000', city: 'Bruxelles', country: 'Belgique' }],
	])('refuses an address outside France: %j', (input) => {
		// Assert
		expect(refused(input)).toEqual({ code: ADDRESS_CODES.COUNTRY_UNSUPPORTED, status: 'failed' });
	});
});

describe('PA-P06 — refusals', () => {
	it.each([
		['75 rue de Vaugirard 75270 Paris Cedex 06'],
		['BP 18\n33506 Libourne Cedex'],
		['CS 70001\n12 rue X\n75002 Paris'],
		['TSA 10001\n75002 Paris'],
		['Poste restante\n75002 Paris'],
	])('refuses a special distribution mention: %j', (input) => {
		// Assert
		expect(refused(input)).toEqual({ code: ADDRESS_CODES.SPECIAL_DISTRIBUTION, status: 'failed' });
	});

	it.each([[42], [true], [{ foo: 'bar' }], ['75002 Paris'], ['12'], [[]]])(
		'refuses an unreadable input: %j',
		(input) => {
			// Assert
			expect(refused(input).code).toBe(ADDRESS_CODES.INPUT_UNREADABLE);
		},
	);

	it.each([[''], ['   '], [null], [undefined]])('leaves an empty value unchanged: %j', (input) => {
		// Assert
		expect(refused(input)).toEqual({ code: FT_CODES.VALUE_EMPTY, status: 'unchanged' });
	});
});
