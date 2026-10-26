/**
 * Characterization of typeVersion 5 of `formatTemplate`
 *
 * @module FormatTemplate/__tests__/format-legacy-characterization
 *
 * @description
 * These tests **freeze the current behaviour**, defects included: they were
 * written before any fix and must never be "fixed". If they change, a v6 fix
 * has leaked into v5 (ADR-0004: no retroactive change).
 *
 * The expected values are the ones **measured on a real n8n 2.37.11 instance**
 * on 2026-09-15, with a sample workflow.
 *
 * typeVersion 5 keeps its French error messages on purpose (ADR-0004,
 * ADR-0012): the assertions below match them as they are
 * (`Impossible de convertir`, `Format de chemin invalide`).
 */

import type { INodeExecutionData } from 'n8n-workflow';

import { createMockExecute } from './helpers/mockExecute';
import { FormatTemplate } from '../FormatTemplate.node';

const node = new FormatTemplate();

/** French national mask from the v5 dropdown, also the one used in production. */
const MASK_FR_NATIONAL = '{0:0# ## ## ## ##}';
/** French international mask from the v5 dropdown. */
const MASK_FR_INTERNATIONAL = '{0:+33 (0) # ## ## ## ##}';

/**
 * Runs the node in typeVersion 5 on a batch of items.
 *
 * @param fields - Rows of `fieldsToFormat.field`
 * @param items - Input items
 * @param continueOnFail - Value returned by `continueOnFail()`
 * @returns Items of output 0
 */
async function runLegacy(
	fields: Array<Record<string, unknown>>,
	items: Array<{ json: Record<string, unknown> }>,
	continueOnFail = false,
): Promise<INodeExecutionData[]> {
	const { context } = createMockExecute({
		nodeParameters: { fieldsToFormat: { field: fields } },
		inputData: items,
		typeVersion: 5,
		nodeName: 'Format Template',
		continueOnFail,
	});
	const [output] = await node.execute.call(context);
	return output;
}

describe('LEG-FT — typeVersion 5, phone mask', () => {
	it.each([
		['+33 3 20 00 00 00', '03 20 00 00 00'],
		['0033 6 12 34 56 78', '06 12 34 56 78'],
		// The leading zero was lost on import (numeric value): v5 returns a literal `#`.
		['612345678', '61 23 45 67 8#'],
		// Eight digits for ten slots: v5 pads with `#`.
		['04 77 00 00', '04 77 00 00 ##'],
		// A value invented out of nothing.
		['', '0# ## ## ## ##'],
		// Two digits cut off, silently.
		['+44 20 7946 0958', '44 20 79 46 09'],
	])('returns "%s" as "%s"', async (input, expected) => {
		// Arrange
		const fields = [{ fieldPath: 'phone', type: 'phone', pattern: MASK_FR_NATIONAL }];

		// Act
		const output = await runLegacy(fields, [{ json: { phone: input } }]);

		// Assert
		expect(output[0].json.phone).toBe(expected);
	});

	it('the `0` of the international mask consumes a digit', async () => {
		// Arrange
		const fields = [{ fieldPath: 'phone', type: 'phone', pattern: MASK_FR_INTERNATIONAL }];

		// Act
		const national = await runLegacy(fields, [{ json: { phone: '01.42.00.00.00' } }]);
		const international = await runLegacy(fields, [{ json: { phone: '+33 3 20 00 00 00' } }]);

		// Assert — the mask is right only for an input that is already national
		expect(national[0].json.phone).toBe('+33 (0) 1 42 00 00 00');
		expect(international[0].json.phone).toBe('+33 (3) 3 32 00 00 00');
	});
});

describe('LEG-FT — typeVersion 5, text case', () => {
	it.each([
		['uppercase', 'Studio Belleville', 'STUDIO BELLEVILLE'],
		['lowercase', 'Studio Belleville', 'studio belleville'],
		['capitalize', 'STUDIO BELLEVILLE', 'Studio belleville'],
		['capitalize', 'ÉLISE DURAND', 'Élise durand'],
		['capitalize', 'SARL DUPONT ET FILS', 'Sarl dupont et fils'],
	])('%s: "%s" becomes "%s"', async (mode, input, expected) => {
		// Arrange
		const fields = [{ fieldPath: 'name', type: 'textCase', textCase: mode }];

		// Act
		const output = await runLegacy(fields, [{ json: { name: input } }]);

		// Assert
		expect(output[0].json.name).toBe(expected);
	});
});

describe('LEG-FT — typeVersion 5, country', () => {
	it.each([
		['France', 'FR'],
		['Belgique', 'BE'],
		['fr', 'FR'],
		// Two non-standard letters: uppercase pass-through, silent.
		['ZZ', 'ZZ'],
		// Empty: pass-through, silent.
		['', ''],
	])('returns "%s" as "%s"', async (input, expected) => {
		// Arrange
		const fields = [{ fieldPath: 'country', type: 'country' }];

		// Act
		const output = await runLegacy(fields, [{ json: { country: input } }]);

		// Assert
		expect(output[0].json.country).toBe(expected);
	});

	it('a single unconvertible item fails the whole node', async () => {
		// Arrange — three contacts, only one is a region
		const fields = [{ fieldPath: 'country', type: 'country' }];
		const items = [
			{ json: { country: 'France' } },
			{ json: { country: 'Bretagne' } },
			{ json: { country: 'Belgique' } },
		];

		// Act & Assert — the whole batch is lost, `Belgique` is never reached
		await expect(runLegacy(fields, items)).rejects.toThrow(
			/Impossible de convertir "Bretagne"/,
		);
	});

	it('`continueOnFail()` is not read — the error is thrown anyway', async () => {
		// Arrange
		const fields = [{ fieldPath: 'country', type: 'country' }];
		const items = [{ json: { country: 'Bretagne' } }];

		// Act & Assert — it is n8n, outside the node, that copies the input to output 0
		await expect(runLegacy(fields, items, true)).rejects.toThrow(/Impossible de convertir/);
	});
});

describe('LEG-FT — typeVersion 5, paths and missing field', () => {
	it('silently skips a missing field', async () => {
		// Arrange
		const fields = [{ fieldPath: 'adresse.pays', type: 'country' }];

		// Act
		const output = await runLegacy(fields, [{ json: { nom: 'Durand' } }]);

		// Assert — no write, no signal
		expect(output[0].json).toEqual({ nom: 'Durand' });
	});

	it('looks for a field named after a value when the path comes from an expression', async () => {
		// Arrange — a `fieldPath` resolved to "France" passes the syntax check
		const fields = [{ fieldPath: 'France', type: 'country' }];

		// Act
		const output = await runLegacy(fields, [{ json: { adresse: { pays: 'France' } } }]);

		// Assert — the node did nothing, and said nothing
		expect(output[0].json).toEqual({ adresse: { pays: 'France' } });
	});

	it('fails the node on a path that looks like a value with a space', async () => {
		// Arrange
		const fields = [{ fieldPath: 'france ', type: 'country' }];

		// Act & Assert
		await expect(runLegacy(fields, [{ json: { pays: 'france' } }])).rejects.toThrow(
			/Format de chemin invalide/,
		);
	});
});

describe('LEG-FT — typeVersion 5, no output contract', () => {
	it('writes neither `_format` nor `metadata.messageHistory`', async () => {
		// Arrange
		const fields = [{ fieldPath: 'country', type: 'country' }];

		// Act
		const output = await runLegacy(fields, [{ json: { country: 'France' } }]);

		// Assert
		expect(output[0].json._format).toBeUndefined();
		expect(output[0].json.metadata).toBeUndefined();
	});

	it('sets no `pairedItem`', async () => {
		// Arrange
		const fields = [{ fieldPath: 'country', type: 'country' }];

		// Act
		const output = await runLegacy(fields, [
			{ json: { country: 'France' } },
			{ json: { country: 'Belgique' } },
		]);

		// Assert
		expect(output.every((item) => item.pairedItem === undefined)).toBe(true);
	});
});
