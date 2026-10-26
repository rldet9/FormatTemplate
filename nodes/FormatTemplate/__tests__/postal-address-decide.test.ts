/**
 * Postal address — the verdict and the outcome (PA-D*, PA-E*)
 *
 * @module FormatTemplate/__tests__/postal-address-decide
 *
 * @description
 * The rules of the verdict on hand-made candidates, one rule per test; the
 * recorded corpus proves them together on real answers.
 */

import type { AddressCandidate } from '../ports/geocoder';
import { ADDRESS_CODES } from '../transforms/postalAddress/codes';
import { decideAddress } from '../transforms/postalAddress/decide';
import { evaluateAddress } from '../transforms/postalAddress/evaluate';
import { ADDRESS_DEFAULTS, resolveAddressSettings } from '../transforms/postalAddress/params';
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
 * Builds a candidate.
 *
 * @param fields - Fields that differ from a plain house-number answer
 * @returns Candidate
 */
function candidate(fields: Partial<AddressCandidate>): AddressCandidate {
	return {
		label: '12 Rue de la Paix 75002 Paris',
		score: 0.95,
		precision: 'housenumber',
		housenumber: '12',
		street: 'Rue de la Paix',
		postcode: '75002',
		city: 'Paris',
		citycode: '75102',
		...fields,
	};
}

const decide = (input: unknown, candidates: AddressCandidate[], overrides = {}) =>
	decideAddress(parsed(input), candidates, { ...ADDRESS_DEFAULTS, ...overrides });

describe('PA-D01 — verified', () => {
	it('verifies an address that agrees on every point', () => {
		// Assert
		expect(decide('12 rue de la Paix 75002 Paris', [candidate({})])).toMatchObject({
			verdict: 'verified',
			corrections: [],
			disagreements: [],
		});
	});

	it('completes a missing postcode without calling it a correction', () => {
		// Assert — the municipality typed at the end of the street is recognized
		expect(decide('12 rue de la Paix Paris', [candidate({})]).verdict).toBe('verified');
	});

	it('accepts a street-level answer when the input gives no number', () => {
		// Assert
		expect(
			decide('Rue de la Paix 75002 Paris', [candidate({ precision: 'street', housenumber: undefined })]).verdict,
		).toBe('verified');
	});

	it('treats B and BIS as the same repetition index', () => {
		// Assert
		expect(decide('1 bis rue de la Paix 75002 Paris', [candidate({ housenumber: '1B' })]).verdict).toBe('verified');
	});

	it('accepts the former municipality as the municipality', () => {
		// Assert
		expect(
			decide('Place Napoléon 50100 Cherbourg-Octeville', [
				candidate({
					precision: 'street',
					housenumber: undefined,
					street: 'Place Napoleon',
					postcode: '50100',
					city: 'Cherbourg-en-Cotentin',
					oldCity: 'Cherbourg-Octeville',
				}),
			]).verdict,
		).toBe('verified');
	});
});

describe('PA-D02 — corrected', () => {
	it.each([
		['12 rue de la Pais 75002 Paris', {}, ['street']],
		['12 rue de la Paix 75008 Paris', {}, ['postcode']],
		['12 rue de la Paix 75002 Pari', {}, ['city']],
		['12 rue de la Paix 75008', {}, ['postcode']],
	])('"%s" → corrected %j', (input, fields, corrections) => {
		// Assert
		expect(decide(input, [candidate(fields)])).toMatchObject({ verdict: 'corrected', corrections });
	});
});

describe('PA-D03 — mismatch', () => {
	it('refuses another street type, whatever the score', () => {
		// Assert
		expect(
			decide('12 avenue de la Paix 75002 Paris', [candidate({ score: 0.99 })]),
		).toMatchObject({ verdict: 'mismatch', disagreements: ['street type'] });
	});

	it('refuses another house number, or another repetition index', () => {
		// Assert
		expect(decide('14 rue de la Paix 75002 Paris', [candidate({})]).disagreements).toEqual(['house number']);
		expect(decide('12 bis rue de la Paix 75002 Paris', [candidate({})]).disagreements).toEqual(['house number']);
	});

	it('refuses when neither the postcode nor the municipality agree', () => {
		// Assert
		expect(decide('12 rue de la Paix 13001 Marseille', [candidate({})]).disagreements).toEqual(['locality']);
	});

	it('refuses a postcode alone from another department', () => {
		// Assert
		expect(decide('12 rue de la Paix 13001', [candidate({})]).disagreements).toEqual(['locality']);
	});

	it('refuses a municipality alone that does not agree', () => {
		// Assert
		expect(decide({ street: '12 rue de la Paix', city: 'Marseille' }, [candidate({})]).disagreements).toEqual([
			'locality',
		]);
	});

	it('cannot tell a wrong municipality from the street without a postcode: the street differs', () => {
		// Assert — "Marseille" stays a word of the street, which then shares one word in two
		expect(decide('12 rue de la Paix Marseille', [candidate({})]).disagreements).toEqual(['street']);
	});
});

describe('PA-D04 — ambiguous', () => {
	const elsewhere = candidate({ score: 0.94, postcode: '33000', city: 'Bordeaux', citycode: '33063' });

	it('refuses two different places that match the input equally', () => {
		// Assert
		expect(decide('12 rue de la Paix', [candidate({}), elsewhere]).verdict).toBe('ambiguous');
	});

	it('does not count a rival the input rules out', () => {
		// Assert — the postcode designates Paris
		expect(decide('12 rue de la Paix 75002', [candidate({}), elsewhere]).verdict).toBe('verified');
	});

	it('does not count a rival outside the margin', () => {
		// Assert
		expect(decide('12 rue de la Paix', [candidate({}), { ...elsewhere, score: 0.8 }]).verdict).toBe('verified');
	});

	it('does not count the same place twice', () => {
		// Assert
		expect(decide('12 rue de la Paix', [candidate({}), candidate({ score: 0.94 })]).verdict).toBe('verified');
	});
});

describe('PA-D05 — imprecise', () => {
	const street = candidate({ precision: 'street', housenumber: undefined, label: 'Rue de la Paix 75002 Paris' });

	it('refuses a street-level answer when the input gives a number', () => {
		// Assert
		expect(decide('250 rue de la Paix 75002 Paris', [street]).verdict).toBe('imprecise');
	});

	it('accepts it when minimumPrecision asks for the street only', () => {
		// Assert
		expect(decide('250 rue de la Paix 75002 Paris', [street], { minimumPrecision: 'street' }).verdict).toBe(
			'verified',
		);
	});

	it('takes the first answer, never the first house number', () => {
		// Act — the second answer is a house number on another street
		const decision = decide('1 bis rue des Écoles 75005 Paris', [
			candidate({ precision: 'street', housenumber: undefined, street: 'Rue des Écoles', postcode: '75005', score: 0.8 }),
			candidate({ housenumber: '1B', street: 'Rue des Carmes', postcode: '75005', score: 0.56 }),
		]);

		// Assert
		expect(decision).toMatchObject({ verdict: 'imprecise' });
		expect(decision.candidate?.street).toBe('Rue des Écoles');
	});
});

describe('PA-D06 — not found', () => {
	it('reports no candidate', () => {
		// Assert
		expect(decide('12 rue de la Paix 75002 Paris', [])).toEqual({
			verdict: 'not_found',
			corrections: [],
			disagreements: [],
		});
	});

	it('reports a best score under the minimum', () => {
		// Assert
		expect(decide('12 rue de la Paix 75002 Paris', [candidate({ score: 0.3 })]).verdict).toBe('not_found');
	});
});

describe('PA-E01 — the outcome written back', () => {
	const address = parsed('Appartement 3\n12 rue de la Paix\n75002 Paris');

	it('writes the postal lines by default', () => {
		// Assert
		expect(evaluateAddress(address, [candidate({})], ADDRESS_DEFAULTS)).toEqual({
			status: 'ok',
			value: ['Appartement 3', '12 RUE DE LA PAIX', '75002 PARIS'],
			diagnostics: [],
		});
	});

	it('writes the label', () => {
		// Assert
		expect(
			evaluateAddress(address, [candidate({})], resolveAddressSettings({ outputFormat: 'label' })).value,
		).toBe('12 Rue de la Paix 75002 Paris');
	});

	it('writes a structured object with the verdict and the identifiers', () => {
		// Act
		const outcome = evaluateAddress(
			address,
			[candidate({ banId: 'b-1', latitude: 48.8, longitude: 2.3 })],
			resolveAddressSettings({ outputFormat: 'structured' }),
		);

		// Assert
		expect(outcome.value).toEqual({
			verdict: 'verified',
			corrections: [],
			precision: 'housenumber',
			score: 0.95,
			label: '12 Rue de la Paix 75002 Paris',
			postalLines: ['Appartement 3', '12 RUE DE LA PAIX', '75002 PARIS'],
			housenumber: '12',
			street: 'Rue de la Paix',
			postcode: '75002',
			city: 'Paris',
			citycode: '75102',
			banId: 'b-1',
			latitude: 48.8,
			longitude: 2.3,
		});
	});

	it('accepts a correction with a warning naming the fields, not their values', () => {
		// Act
		const outcome = evaluateAddress(parsed('12 rue de la Paix 75008 Paris'), [candidate({})], ADDRESS_DEFAULTS);

		// Assert
		expect(outcome.status).toBe('ok');
		expect(outcome.diagnostics).toEqual([
			expect.objectContaining({
				code: ADDRESS_CODES.CORRECTED,
				severity: 'warning',
				message: 'Address accepted after correcting: postcode.',
			}),
		]);
	});

	it('refuses a correction when acceptCorrections is off, and leaves no value', () => {
		// Act
		const outcome = evaluateAddress(
			parsed('12 rue de la Paix 75008 Paris'),
			[candidate({})],
			resolveAddressSettings({ acceptCorrections: false }),
		);

		// Assert — ADR-0002: a refused verdict never writes a value
		expect(outcome.status).toBe('failed');
		expect(outcome.value).toBeUndefined();
		expect(outcome.diagnostics[0].code).toBe(ADDRESS_CODES.CORRECTED);
	});

	it.each([
		['12 avenue de la Paix 75002 Paris', [candidate({})], ADDRESS_CODES.MISMATCH],
		['250 rue de la Paix 75002 Paris', [candidate({ precision: 'street', housenumber: undefined })], ADDRESS_CODES.IMPRECISE],
		['12 rue de la Paix 75002 Paris', [], ADDRESS_CODES.NOT_FOUND],
	])('fails "%s" with its code and no value', (input, candidates, code) => {
		// Act
		const outcome = evaluateAddress(parsed(input), candidates as AddressCandidate[], ADDRESS_DEFAULTS);

		// Assert
		expect(outcome).toMatchObject({ status: 'failed', diagnostics: [expect.objectContaining({ code })] });
		expect(outcome.value).toBeUndefined();
	});
});

describe('PA-E02 — settings', () => {
	it('falls back to the calibrated defaults for missing or invalid values', () => {
		// Assert
		expect(resolveAddressSettings({ minScore: 7, outputFormat: 'xml', stripAccents: 'yes' })).toEqual(ADDRESS_DEFAULTS);
	});

	it('reads numbers written as text, as n8n may store them', () => {
		// Assert
		expect(resolveAddressSettings({ minScore: '0.6' }).minScore).toBe(0.6);
	});
});
