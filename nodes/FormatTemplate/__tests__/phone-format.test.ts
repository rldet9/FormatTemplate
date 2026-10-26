/**
 * v6 `phone` transform — pure module
 *
 * @module FormatTemplate/__tests__/phone-format
 *
 * @description
 * One test per row of the v5 phone defect table (renderings measured on a
 * real n8n 2.37.11 instance, 2026-09-15), plus parsing, the four output
 * formats, the capacity check, the `\#` escape and the invalid mask.
 *
 * The numbering plans of every country (ADR-0016) are proven in
 * `phone-plans.test.ts`. Two rows here followed the plans of the first
 * typeVersion 6 release, when a British number and a Belgian `defaultCountry`
 * were unsupported. They now use a calling code and a code no country holds:
 * what they prove — an unsupported plan is left intact — is unchanged.
 *
 * These tests import neither `n8n-workflow` nor the node file: that is the
 * condition for the core to stay testable outside n8n (ADR-0007).
 */

import { FT_CODES } from '../kernel/diagnostics';
import { formatPhone, maskCapacity, validateMask } from '../transforms/phone/format';

/** Shortcut: the codes carried by an outcome. */
const codes = (outcome: { diagnostics: Array<{ code: string }> }) =>
	outcome.diagnostics.map((d) => d.code);

describe('PH-01 — the six rows of the v5 phone defect, fixed', () => {
	it('converts a French international input', () => {
		// Act
		const outcome = formatPhone('+33 3 20 00 00 00', { phoneOutput: 'national' });

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: '03 20 00 00 00' });
		expect(codes(outcome)).toEqual([]);
	});

	it('converts an input prefixed with 00', () => {
		// Act
		const outcome = formatPhone('0033 6 12 34 56 78', { phoneOutput: 'national' });

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: '06 12 34 56 78' });
	});

	it('rejects a numeric value that lost its leading zero', () => {
		// Arrange — this is the form in which n8n delivers `0612345678` imported as a number
		const outcome = formatPhone(612345678, { phoneOutput: 'national' });

		// Assert — v5 returned `61 23 45 67 8#`
		expect(outcome.status).toBe('failed');
		expect(outcome.value).toBeUndefined();
		expect(codes(outcome)).toEqual([
			FT_CODES.PHONE_NUMERIC_INPUT,
			FT_CODES.PHONE_LENGTH_MISMATCH,
		]);
	});

	it('rejects eight digits where the numbering plan expects ten', () => {
		// Act — v5 returned `04 77 00 00 ##`
		const outcome = formatPhone('04 77 00 00', { phoneOutput: 'national' });

		// Assert
		expect(outcome.status).toBe('failed');
		expect(codes(outcome)).toEqual([FT_CODES.PHONE_LENGTH_MISMATCH]);
	});

	it('invents nothing from an empty string', () => {
		// Act — v5 returned `0# ## ## ## ##`, a valid-looking number
		const outcome = formatPhone('', { phoneOutput: 'national' });

		// Assert
		expect(outcome.status).toBe('unchanged');
		expect(outcome.value).toBeUndefined();
		expect(codes(outcome)).toEqual([FT_CODES.VALUE_EMPTY]);
	});

	it('no longer truncates a British number: it is read and rendered (ADR-0016)', () => {
		// Act — v5 returned `44 20 79 46 09`, two digits cut off silently
		const outcome = formatPhone('+44 20 7946 0958', { phoneOutput: 'national' });

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: '020 7946 0958' });
	});

	it('does not truncate a number from an unsupported numbering plan', () => {
		// Act — +800 is a non-geographic service: no country holds it
		const outcome = formatPhone('+800 1234 5678', { phoneOutput: 'national' });

		// Assert
		expect(outcome.status).toBe('failed');
		expect(outcome.value).toBeUndefined();
		expect(codes(outcome)).toEqual([FT_CODES.PHONE_PLAN_UNSUPPORTED]);
	});
});

describe('PH-02 — parsing: three spellings, one number', () => {
	it.each([
		['+33 3 20 00 00 00'],
		['0320000000'],
		['00 33 3 20 00 00 00'],
	])('"%s" parses as the same number', (input) => {
		// Assert — acceptance criterion: every spelling gives the same four renderings
		expect(formatPhone(input, { phoneOutput: 'national' }).value).toBe('03 20 00 00 00');
		expect(formatPhone(input, { phoneOutput: 'international' }).value).toBe(
			'+33 3 20 00 00 00',
		);
		expect(formatPhone(input, { phoneOutput: 'e164' }).value).toBe('+33320000000');
		expect(
			formatPhone(input, { phoneOutput: 'mask', phoneMask: '+33 (0) # ## ## ## ##' }).value,
		).toBe('+33 (0) 3 20 00 00 00');
	});

	it('the `0` of the international mask is a literal, no longer a slot', () => {
		// Arrange — v5 returned `+33 (3) 3 32 00 00 00` for this input (measured on a real
		// n8n 2.37.11 instance, 2026-09-15)
		const outcome = formatPhone('+33 3 20 00 00 00', {
			phoneOutput: 'mask',
			phoneMask: '+33 (0) # ## ## ## ##',
		});

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: '+33 (0) 3 20 00 00 00' });
	});

	it('parses a national input of the `defaultCountry`', () => {
		// Act
		const outcome = formatPhone('(212) 555-1234', {
			defaultCountry: 'US',
			phoneOutput: 'e164',
		});

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: '+12125551234' });
	});

	it('rejects a `defaultCountry` whose numbering plan is not in the table', () => {
		// Act — `EU` is a region code, not a country
		const outcome = formatPhone('02 345 67 89', { defaultCountry: 'EU' });

		// Assert — the value stays intact, and the operator knows why
		expect(outcome.status).toBe('failed');
		expect(codes(outcome)).toEqual([FT_CODES.PHONE_PLAN_UNSUPPORTED]);
		expect(outcome.diagnostics[0].parameter).toBe('defaultCountry');
	});

	it('requires the trunk prefix of a plan that mandates it', () => {
		// Act — 9 digits, the length of the French NSN, but without the 0
		const outcome = formatPhone('320000000', { defaultCountry: 'FR' });

		// Assert — the node does not rebuild the zero: it reports it
		expect(outcome.status).toBe('failed');
		expect(codes(outcome)).toEqual([FT_CODES.PHONE_LENGTH_MISMATCH]);
	});

	it('accepts an optional trunk prefix', () => {
		// Act
		expect(formatPhone('1 212 555 1234', { defaultCountry: 'US', phoneOutput: 'e164' }).value).toBe(
			'+12125551234',
		);
		expect(formatPhone('2125551234', { defaultCountry: 'US', phoneOutput: 'e164' }).value).toBe(
			'+12125551234',
		);
	});

	it('flags a value without any digit', () => {
		// Act
		const outcome = formatPhone('non renseigné', {});

		// Assert
		expect(outcome.status).toBe('failed');
		expect(codes(outcome)).toEqual([FT_CODES.PHONE_UNPARSEABLE]);
	});
});

describe('PH-03 — mask grammar', () => {
	it('counts only `#` as slots', () => {
		// Assert
		expect(maskCapacity('0# ## ## ## ##')).toBe(9);
		expect(maskCapacity('+33 (0) # ## ## ## ##')).toBe(9);
		expect(maskCapacity('(###) ###-####')).toBe(10);
	});

	it('`\\#` renders a literal `#` and consumes no digit', () => {
		// Arrange
		const mask = '\\# ### ### ####';

		// Assert
		expect(maskCapacity(mask)).toBe(10);
		expect(
			formatPhone('2125551234', { defaultCountry: 'US', phoneOutput: 'mask', phoneMask: mask })
				.value,
		).toBe('# 212 555 1234');
	});

	it('rejects a mask without any slot — configuration error', () => {
		// Assert
		expect(validateMask('+33')?.code).toBe(FT_CODES.PHONE_MASK_INVALID);
		expect(validateMask('')?.code).toBe(FT_CODES.PHONE_MASK_INVALID);
	});

	it('rejects a v5 mask left as is', () => {
		// Arrange — under the v6 grammar, `{0:` would be copied and the `0` would stop
		// being a slot: better to reject the configuration than to deliver that output
		const diagnostic = validateMask('{0:0# ## ## ## ##}');

		// Assert
		expect(diagnostic?.code).toBe(FT_CODES.PHONE_MASK_INVALID);
		expect(diagnostic?.message).toContain('typeVersion 5');
	});

	it('rejects a mask whose capacity does not match the number', () => {
		// Act
		const outcome = formatPhone('+33 3 20 00 00 00', {
			phoneOutput: 'mask',
			phoneMask: '## ## ##',
		});

		// Assert — no unfilled slot is output as a literal
		expect(outcome.status).toBe('failed');
		expect(codes(outcome)).toEqual([FT_CODES.PHONE_LENGTH_MISMATCH]);
		expect(outcome.diagnostics[0].message).toContain('6 mask slot');
	});
});

describe('PH-04 — ADR-0006: no diagnostic repeats the value', () => {
	it.each([
		['0612345678', {}],
		['+800 1234 5678', {}],
		['04 77 00 00', {}],
		['20 7946 0958', { defaultCountry: 'GB' }],
		['+34 123 456 789', {}],
		['+49 16412345', {}],
		['+49 1512 3456789', { phoneOutput: 'mask' as const, phoneMask: '## ##' }],
	])('"%s"', (input, params) => {
		// Act
		const outcome = formatPhone(input, params);

		// Assert
		const serialized = JSON.stringify(outcome.diagnostics);
		expect(serialized).not.toContain(input.replace(/\D/g, ''));
	});
});
