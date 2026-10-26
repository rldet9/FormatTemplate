/**
 * Postal address — calibration of the thresholds (PA-K*)
 *
 * @module FormatTemplate/__tests__/postal-address-calibration
 *
 * @description
 * ADR-0013. The defaults of `transforms/postalAddress/params.ts` are not
 * guesses: each one sits inside the range where the recorded corpus gives no
 * false acceptance and no false rejection. These tests sweep each threshold
 * and keep the ranges documented in `params.ts` true. If the recording is
 * refreshed and a range moves, they fail — and the documentation must move
 * with them.
 */

import { decideAddress, type DecisionOptions } from '../transforms/postalAddress/decide';
import { ADDRESS_DEFAULTS } from '../transforms/postalAddress/params';
import { ACCEPTED, geocodedCases } from './helpers/postalCorpus';

const cases = geocodedCases();

/**
 * Counts the errors of the verdict over the corpus with some thresholds.
 *
 * @param overrides - Thresholds to change
 * @returns Ids of the false acceptances and false rejections
 */
function errors(overrides: Partial<DecisionOptions>): { falseAcceptances: string[]; falseRejections: string[] } {
	const options = { ...ADDRESS_DEFAULTS, ...overrides };
	const falseAcceptances: string[] = [];
	const falseRejections: string[] = [];
	for (const c of cases) {
		const accepted = ACCEPTED.has(decideAddress(c.address, c.candidates, options).verdict);
		const shouldAccept = c.expected === 'verified' || c.expected === 'corrected';
		if (accepted && !shouldAccept) falseAcceptances.push(c.id);
		if (!accepted && shouldAccept) falseRejections.push(c.id);
	}
	return { falseAcceptances, falseRejections };
}

const NONE = { falseAcceptances: [], falseRejections: [] };

describe('PA-K01 — the defaults make no error on the corpus', () => {
	it('has no false acceptance and no false rejection', () => {
		// Assert
		expect(errors({})).toEqual(NONE);
	});
});

describe('PA-K02 — minScore: safe from 0.30 to 0.62', () => {
	it.each([0.3, 0.4, 0.5, 0.6, 0.62])('makes no error at %s', (minScore) => {
		// Assert — wrong answers are caught by the comparison, not by the score
		expect(errors({ minScore })).toEqual(NONE);
	});

	it('starts rejecting right addresses above 0.62', () => {
		// Assert — the lowest right answer scored 0.620 (abbreviations everywhere)
		expect(errors({ minScore: 0.65 }).falseRejections).toEqual(['V21']);
	});
});

describe('PA-K03 — ambiguityMargin: safe from 0.005 to 0.5', () => {
	it.each([0.005, 0.05, 0.2, 0.5])('makes no error at %s', (ambiguityMargin) => {
		// Assert — a rival must also match the input, so a wide margin costs nothing
		expect(errors({ ambiguityMargin })).toEqual(NONE);
	});

	it('accepts truly ambiguous inputs at 0', () => {
		// Assert — "1 rue de la Gare" without a town: thousands of answers within 0.005
		expect(errors({ ambiguityMargin: 0 }).falseAcceptances).toEqual(['A01', 'A02', 'A03']);
	});
});

describe('PA-K04 — streetSimilarity: must exceed 2/3', () => {
	it.each([0.67, 0.8, 0.9, 1])('makes no error at %s', (streetSimilarity) => {
		// Assert
		expect(errors({ streetSimilarity })).toEqual(NONE);
	});

	it('accepts "rue de la Paix Royale" as "Rue de la Paix" at 0.6', () => {
		// Assert — one shared word in three (Dice 2/3): another real street exists
		expect(errors({ streetSimilarity: 0.6 }).falseAcceptances).toEqual(['M06']);
	});
});
