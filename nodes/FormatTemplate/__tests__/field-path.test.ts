/**
 * `kernel/fieldPath` — shape, reading, writing and provenance
 *
 * @module FormatTemplate/__tests__/field-path
 *
 * @description
 * Valid and invalid paths, array indices, reserved paths, expression
 * detection. An invalid path and a missing path are two different things
 * (ADR-0003).
 */

import {
	isValidFieldPath,
	looksLikeExpressionPath,
	parseFieldPath,
	readAtPath,
	writeAtPath,
} from '../kernel/fieldPath';

/** Shortcut: tokens of a path assumed to be valid. */
const tokens = (fieldPath: string) => {
	const parsed = parseFieldPath(fieldPath);
	if (!parsed.ok) throw new Error(`unexpected path: ${fieldPath}`);
	return parsed.tokens;
};

describe('FP-01 — path shape', () => {
	it.each([
		'phone',
		'contact.mobile',
		'domain.mobilePhone',
		'adresse[0].pays',
		'data[0][1].country',
		'_interne.valeur',
	])('accepts "%s"', (fieldPath) => {
		expect(isValidFieldPath(fieldPath)).toBe(true);
	});

	it.each([
		['adresse-postale.pays', 'a hyphen is not a property separator'],
		['france ', 'the value of an expression, trailing space included'],
		['0phone', 'a segment does not start with a digit'],
		['contact..mobile', 'empty segment'],
		['', 'empty path'],
		['   ', 'blank path'],
		['contact.mobile!', 'character outside the grammar'],
		['$json.phone', 'n8n expression pasted as is'],
	])('rejects "%s" (%s)', (fieldPath) => {
		// Assert
		const parsed = parseFieldPath(fieldPath);
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.reason).toBe('invalid');
			expect(parsed.message).toContain('Invalid path format');
		}
	});

	it.each(['__proto__', 'a.__proto__.b', 'constructor.phone', 'a.b.prototype'])(
		'rejects the reserved key in "%s"',
		(fieldPath) => {
			// Assert — prototype-pollution guard: `__proto__`, `constructor` and `prototype` are reserved
			const parsed = parseFieldPath(fieldPath);
			expect(parsed.ok).toBe(false);
			if (!parsed.ok) expect(parsed.reason).toBe('reserved');
		},
	);

	it('keeps the meaning of the v5 message — the name, not the value (now in English, ADR-0012)', () => {
		// Act
		const parsed = parseFieldPath('france ');

		// Assert
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.message).toContain(
				'Specify the name of the property (like "phone"), not its value.',
			);
		}
	});
});

describe('FP-02 — reading: presence told apart from value', () => {
	it('reads a nested value', () => {
		expect(readAtPath({ adresse: { pays: 'France' } }, tokens('adresse.pays'))).toEqual({
			found: true,
			value: 'France',
		});
	});

	it('reads an array element', () => {
		expect(readAtPath({ lignes: [{ pays: 'BE' }] }, tokens('lignes[0].pays'))).toEqual({
			found: true,
			value: 'BE',
		});
	});

	it('tells "missing" apart from "present and null"', () => {
		// Assert — this is what separates FT_PATH_NOT_FOUND from FT_VALUE_EMPTY
		expect(readAtPath({ nom: 'Durand' }, tokens('adresse.pays')).found).toBe(false);
		expect(readAtPath({ pays: null }, tokens('pays'))).toEqual({ found: true, value: null });
		expect(readAtPath({ pays: '' }, tokens('pays'))).toEqual({ found: true, value: '' });
	});

	it('does not return a property inherited from the prototype', () => {
		// Assert
		expect(readAtPath({}, tokens('toString')).found).toBe(false);
	});

	it('returns "missing" for an out-of-bounds index', () => {
		expect(readAtPath({ lignes: [] }, tokens('lignes[2].pays')).found).toBe(false);
	});
});

describe('FP-03 — writing', () => {
	it('writes at the same path without touching the rest', () => {
		// Arrange
		const item: Record<string, unknown> = { adresse: { pays: 'France', ville: 'Lille' } };

		// Act
		writeAtPath(item, tokens('adresse.pays'), 'FR');

		// Assert
		expect(item).toEqual({ adresse: { pays: 'FR', ville: 'Lille' } });
	});

	it('writes into an array', () => {
		// Arrange
		const item: Record<string, unknown> = { lignes: [{ pays: 'France' }, { pays: 'Belgique' }] };

		// Act
		writeAtPath(item, tokens('lignes[1].pays'), 'BE');

		// Assert
		expect(item.lignes).toEqual([{ pays: 'France' }, { pays: 'BE' }]);
	});

	it('creates the container that matches the next token', () => {
		// Arrange
		const item: Record<string, unknown> = {};

		// Act
		writeAtPath(item, tokens('lignes[0].pays'), 'FR');

		// Assert
		expect(item).toEqual({ lignes: [{ pays: 'FR' }] });
	});
});

describe('FP-04 — provenance: a path that came from an expression', () => {
	it('does not flag a `=domain.phone`, which works', () => {
		// Assert — 27 `fieldPath` values in production have this shape: it is not a defect
		expect(looksLikeExpressionPath('=domain.phone', 'domain.phone')).toBe(false);
	});

	it('flags an expression that actually returned a value', () => {
		// Assert — this is the costly case: the node looks for a field named "France"
		expect(looksLikeExpressionPath('={{ $json.pays }}', 'France')).toBe(true);
	});

	it('does not flag a literal without prefix', () => {
		expect(looksLikeExpressionPath('domain.phone', 'domain.phone')).toBe(false);
	});

	it('flags nothing when the raw parameter is missing', () => {
		expect(looksLikeExpressionPath(undefined, 'domain.phone')).toBe(false);
	});
});
