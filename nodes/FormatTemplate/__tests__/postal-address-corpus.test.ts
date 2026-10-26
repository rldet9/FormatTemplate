/**
 * Postal address — the recorded corpus (PA-C*)
 *
 * @module FormatTemplate/__tests__/postal-address-corpus
 *
 * @description
 * ADR-0013. Fifty-five real inputs, each with the verdict a careful human
 * gives, decided before reading the algorithm's output; the geocoder answers
 * were recorded once from the Géoplateforme service and are replayed offline.
 * Public places only — no private person's address.
 *
 * The acceptance criterion is asymmetric on purpose: **no wrong address may
 * ever be accepted** (PA-C02). Rejecting a right one is a cost; accepting a
 * wrong one is a defect.
 */

import { mapSearchResponse } from '../adapters/geoplateforme/mapResponse';
import { decideAddress } from '../transforms/postalAddress/decide';
import { evaluateAddress } from '../transforms/postalAddress/evaluate';
import { ADDRESS_DEFAULTS } from '../transforms/postalAddress/params';
import { parseAddressInput } from '../transforms/postalAddress/parseInput';
import { tokenize } from '../transforms/postalAddress/text';
import { ACCEPTED, geocodedCases, loadCorpus, loadRecording, meets } from './helpers/postalCorpus';

const corpus = loadCorpus();
const recording = loadRecording();
const geocoded = geocodedCases();

describe('PA-C01 — the corpus and its recording are consistent', () => {
	it('holds the expected mix of cases', () => {
		// Assert — a corpus that loses its hard cases stops proving anything
		const count = (prefix: string) => corpus.filter((c) => c.id.startsWith(prefix)).length;
		expect(corpus.length).toBeGreaterThanOrEqual(55);
		expect(count('V')).toBeGreaterThanOrEqual(28);
		expect(count('C') + count('I') + count('M') + count('A') + count('N')).toBeGreaterThanOrEqual(19);
		expect(count('P')).toBeGreaterThanOrEqual(8);
	});

	it.each(corpus.filter((c) => !c.expected.startsWith('parse:')).map((c) => [c.id, c] as const))(
		'%s: the parser still builds the recorded query',
		(_id, corpusCase) => {
			// Act
			const parsed = parseAddressInput(corpusCase.input);

			// Assert — if this fails, the query changed: update the corpus and re-record
			expect(parsed.ok).toBe(true);
			if (parsed.ok) {
				expect(parsed.address.query).toBe(corpusCase.query);
				expect(recording.responses[parsed.address.query]).toBeDefined();
			}
		},
	);

	it('records its source, licence, endpoint and date', () => {
		// Assert — Base Adresse Nationale data is reused under the Etalab Open Licence 2.0
		expect(recording.$source).toMatch(/Base Adresse Nationale/);
		expect(recording.$source).toMatch(/Licence Ouverte/);
		expect(recording.endpoint).toBe('https://data.geopf.fr/geocodage/search');
		expect(recording.parameters).toEqual({ index: 'address', limit: '5', autocomplete: '0' });
		expect(recording.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('PA-C02 — no wrong address is ever accepted', () => {
	it('accepts none of the cases a human rejects', () => {
		// Act
		const falseAcceptances = geocoded
			.filter((c) => !['verified', 'corrected'].includes(c.expected))
			.filter((c) => ACCEPTED.has(decideAddress(c.address, c.candidates, ADDRESS_DEFAULTS).verdict))
			.map((c) => c.id);

		// Assert
		expect(falseAcceptances).toEqual([]);
	});
});

describe('PA-C03 — every case gets the verdict a human gives', () => {
	it.each(geocoded.map((c) => [c.id, c.expected, c] as const))('%s → %s', (_id, expected, geocodedCase) => {
		// Act
		const { verdict } = decideAddress(geocodedCase.address, geocodedCase.candidates, ADDRESS_DEFAULTS);

		// Assert
		expect(meets(expected, verdict)).toBe(true);
	});

	it.each(
		corpus.filter((c) => c.expected.startsWith('parse:')).map((c) => [c.id, c.expected.slice(6), c] as const),
	)('%s is refused before any lookup with %s', (_id, code, corpusCase) => {
		// Act
		const parsed = parseAddressInput(corpusCase.input);

		// Assert
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) expect(parsed.diagnostic.code).toBe(code);
	});
});

describe('PA-C04 — the cases that motivated the design', () => {
	const verdictOf = (id: string) => {
		const geocodedCase = geocoded.find((c) => c.id === id);
		if (!geocodedCase) throw new Error(`case ${id} not found`);
		return decideAddress(geocodedCase.address, geocodedCase.candidates, ADDRESS_DEFAULTS);
	};

	it('accepts the right address that scores low (V02, 0.656)', () => {
		// Assert
		expect(verdictOf('V02')).toMatchObject({ verdict: 'verified' });
	});

	it('refuses the wrong address that scores almost as high (M01, 0.632)', () => {
		// Assert — an avenue is not a square, whatever the score
		expect(verdictOf('M01')).toMatchObject({ verdict: 'mismatch', disagreements: ['street type'] });
	});

	it('never resolves "1 bis rue des Écoles" on another street (I01)', () => {
		// Act
		const decision = verdictOf('I01');

		// Assert — the second answer is a house number on Rue des Carmes
		expect(decision.verdict).toBe('imprecise');
		expect(decision.candidate?.street).toBe('Rue des Écoles');
	});
});

describe('PA-C05 — messages never carry the address (ADR-0006)', () => {
	it('keeps every word of the input out of every diagnostic', () => {
		// Act
		const leaks: string[] = [];
		for (const geocodedCase of geocoded) {
			const outcome = evaluateAddress(geocodedCase.address, geocodedCase.candidates, ADDRESS_DEFAULTS);
			const words = tokenize(geocodedCase.address.query).filter((word) => word.length >= 5 && !/^\d+$/.test(word));
			const messages = tokenize(outcome.diagnostics.map((d) => d.message).join(' '));
			for (const word of words) if (messages.includes(word)) leaks.push(`${geocodedCase.id}: ${word}`);
		}

		// Assert
		expect(leaks).toEqual([]);
	});
});

describe('PA-C06 — the recording maps cleanly', () => {
	it('maps every recorded answer without losing a feature', () => {
		// Act & Assert
		for (const [query, body] of Object.entries(recording.responses)) {
			const features = (body as { features: unknown[] }).features;
			expect({ query, count: mapSearchResponse(body).length }).toEqual({ query, count: features.length });
		}
	});
});
