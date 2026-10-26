/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals -- tests read the sources and fixtures from disk; they are never compiled into the package */
/**
 * Numbering plans of every country (ADR-0016)
 *
 * @module FormatTemplate/__tests__/phone-plans
 *
 * @description
 * The `phone` transformation reads and renders with a table generated from the
 * libphonenumber metadata (`transforms/phone/numberingPlans.ts`). These tests
 * prove it on four fronts:
 *
 * - **PH-05** — every example number of every plan of the metadata
 *   (`fixtures/phone/examples.json`, written by the generator) is read, and
 *   its national and international renderings read back to the same number;
 * - **PH-06** — renderings of 44 real-shaped numbers of 26 territories, each one
 *   checked against libphonenumber's reference implementation
 *   (`google-libphonenumber` 3.2.47) when the table was generated: GB, DE, IT,
 *   ES, BE, CH, NL, plans of variable length, shared calling codes;
 * - **PH-07** — the three historical plans FR, US, CA keep the reading and
 *   the grouping of the first typeVersion 6 release (ADR-0004);
 * - **PH-08** — the reading rules and the diagnostics that are the node's own;
 * - **PH-09** — the generated table itself: origin, size, options.
 *
 * These tests import neither `n8n-workflow` nor the node file (ADR-0007).
 */

import * as fs from 'fs';
import * as path from 'path';

import { FT_CODES } from '../kernel/diagnostics';
import { formatPhone, type PhoneParams } from '../transforms/phone/format';
import {
	CALLING_CODES,
	NUMBERING_PLANS,
	PHONE_COUNTRY_OPTIONS,
	PHONE_METADATA,
} from '../transforms/phone/numberingPlans';

/** Root of the node folder. */
const ROOT = path.join(__dirname, '..');

/** Shortcut: the codes carried by an outcome. */
const codes = (outcome: { diagnostics: Array<{ code: string }> }) =>
	outcome.diagnostics.map((d) => d.code);

/** Example numbers of the metadata, by territory and number type. */
const EXAMPLES = JSON.parse(
	fs.readFileSync(path.join(__dirname, 'fixtures', 'phone', 'examples.json'), 'utf-8'),
) as {
	version: string;
	territories: Record<string, { callingCode: string; examples: Record<string, string> }>;
};

/**
 * Examples outside the historical plans (PH-07): the Canadian plan reads ten digits, as the
 * first typeVersion 6 release did, so its seven-digit `310` service numbers stay refused.
 */
const OUTSIDE_HISTORICAL_PLANS = ['CA:uan'];

/** Every (territory, type, example) of the fixture the plans read. */
const ALL_EXAMPLES = Object.entries(EXAMPLES.territories)
	.flatMap(([iso2, territory]) =>
		Object.entries(territory.examples).map(([type, nsn]) => ({
			iso2,
			type,
			nsn,
			callingCode: territory.callingCode,
		})),
	)
	.filter(({ iso2, type }) => !OUTSIDE_HISTORICAL_PLANS.includes(`${iso2}:${type}`));

/**
 * Example numbers whose plan defines no national grouping while it writes a national
 * prefix: their national rendering is refused with `FT_PHONE_FORMAT_UNAVAILABLE` (ADR-0002).
 * libphonenumber writes their digits ungrouped and without the prefix.
 */
const NATIONAL_FORMAT_UNAVAILABLE = ['DE:pager', 'KI:fixedLine', 'KI:mobile', 'KI:voip', 'ZM:voip'];

describe('PH-05 — every example number of every plan', () => {
	it('reads the fixture (guard of the test itself)', () => {
		// Assert — an empty corpus would make every rule pass
		expect(Object.keys(EXAMPLES.territories)).toHaveLength(Object.keys(NUMBERING_PLANS).length);
		expect(ALL_EXAMPLES.length).toBeGreaterThan(1100);
		expect(EXAMPLES.version).toBe(PHONE_METADATA.version);
	});

	it('reads every example written internationally, and renders it in E.164', () => {
		// Act
		const failures = ALL_EXAMPLES.filter(({ callingCode, nsn }) => {
			const outcome = formatPhone(`+${callingCode} ${nsn}`, { phoneOutput: 'e164' });
			return outcome.status !== 'ok' || outcome.value !== `+${callingCode}${nsn}`;
		}).map(({ iso2, type }) => `${iso2}:${type}`);

		// Assert
		expect(failures).toEqual([]);
	});

	it.each(['national', 'international'] as const)(
		'renders every example in %s shape, and reads the rendering back to the same number',
		(phoneOutput) => {
			// Act
			const problems: string[] = [];
			const unavailable: string[] = [];
			for (const { iso2, type, nsn, callingCode } of ALL_EXAMPLES) {
				const rendered = formatPhone(`+${callingCode}${nsn}`, { phoneOutput });
				if (rendered.status !== 'ok') {
					if (codes(rendered).join() === FT_CODES.PHONE_FORMAT_UNAVAILABLE) unavailable.push(`${iso2}:${type}`);
					else problems.push(`${iso2}:${type} ${codes(rendered).join()}`);
					continue;
				}
				const back = formatPhone(rendered.value, { defaultCountry: iso2, phoneOutput: 'e164' });
				if (back.value !== `+${callingCode}${nsn}`) problems.push(`${iso2}:${type} → ${codes(back).join()}`);
			}

			// Assert — an international rendering always exists (ungrouped at worst)
			expect(problems).toEqual([]);
			expect(unavailable).toEqual(phoneOutput === 'national' ? NATIONAL_FORMAT_UNAVAILABLE : []);
		},
	);
});

describe('PH-06 — renderings checked against libphonenumber', () => {
	/**
	 * [territory, input, national, international, E.164]. The three renderings are those of
	 * libphonenumber's reference implementation for the same input; the national one is also
	 * read back with the territory as `defaultCountry`.
	 */
	const CASES: ReadonlyArray<readonly [string, string, string, string, string]> = [
		['GB', '+44 20 7946 0958', '020 7946 0958', '+44 20 7946 0958', '+442079460958'],
		['GB', '+44 7400 123456', '07400 123456', '+44 7400 123456', '+447400123456'],
		['DE', '+49 30 123456', '030 123456', '+49 30 123456', '+4930123456'],
		['DE', '+49 30 12345678', '030 12345678', '+49 30 12345678', '+493012345678'],
		['DE', '+49 1512 3456789', '01512 3456789', '+49 1512 3456789', '+4915123456789'],
		['DE', '+49 89 1234567', '089 1234567', '+49 89 1234567', '+49891234567'],
		['DE', '+49 6221 1234', '06221 1234', '+49 6221 1234', '+4962211234'],
		['DE', '+49 33203 12345', '033203 12345', '+49 33203 12345', '+493320312345'],
		['IT', '+39 06 1234 5678', '06 1234 5678', '+39 06 1234 5678', '+390612345678'],
		['IT', '+39 02 1234567', '02 123 4567', '+39 02 123 4567', '+39021234567'],
		['IT', '+39 312 345 6789', '312 345 6789', '+39 312 345 6789', '+393123456789'],
		['IT', '+39 0471 123456', '0471 123456', '+39 0471 123456', '+390471123456'],
		['ES', '+34 912 34 56 78', '912 34 56 78', '+34 912 34 56 78', '+34912345678'],
		['ES', '+34 612 34 56 78', '612 34 56 78', '+34 612 34 56 78', '+34612345678'],
		['BE', '+32 470 12 34 56', '0470 12 34 56', '+32 470 12 34 56', '+32470123456'],
		['BE', '+32 71 12 34 56', '071 12 34 56', '+32 71 12 34 56', '+3271123456'],
		['CH', '+41 21 234 56 78', '021 234 56 78', '+41 21 234 56 78', '+41212345678'],
		['CH', '+41 78 123 45 67', '078 123 45 67', '+41 78 123 45 67', '+41781234567'],
		['NL', '+31 20 123 4567', '020 123 4567', '+31 20 123 4567', '+31201234567'],
		['NL', '+31 6 12345678', '06 12345678', '+31 6 12345678', '+31612345678'],
		['NL', '+31 800 1234', '0800 1234', '+31 800 1234', '+318001234'],
		['AT', '+43 1 234567890', '01 234567890', '+43 1 234567890', '+431234567890'],
		['AT', '+43 1 23456', '01 23456', '+43 1 23456', '+43123456'],
		['AT', '+43 664 123456', '0664 123456', '+43 664 123456', '+43664123456'],
		['FI', '+358 9 1234567', '09 1234567', '+358 9 1234567', '+35891234567'],
		['FI', '+358 41 2345678', '041 2345678', '+358 41 2345678', '+358412345678'],
		['PT', '+351 212 345 678', '21 234 5678', '+351 21 234 5678', '+351212345678'],
		['LU', '+352 27 12 34 56', '27 12 34 56', '+352 27 12 34 56', '+35227123456'],
		['MC', '+377 99 12 34 56', '99 12 34 56', '+377 99 12 34 56', '+37799123456'],
		['MA', '+212 6 50 12 34 56', '06 50 12 34 56', '+212 6 50 12 34 56', '+212650123456'],
		['RE', '+262 262 16 12 34', '0262 16 12 34', '+262 262 16 12 34', '+262262161234'],
		['GP', '+590 590 20 12 34', '0590 20 12 34', '+590 590 20 12 34', '+590590201234'],
		['BR', '+55 11 96123 4567', '(11) 96123-4567', '+55 11 96123-4567', '+5511961234567'],
		['AR', '+54 9 11 2345 6789', '011 15-2345-6789', '+54 9 11 2345-6789', '+5491123456789'],
		['MX', '+52 55 1234 5678', '55 1234 5678', '+52 55 1234 5678', '+525512345678'],
		['JP', '+81 3 1234 5678', '03-1234-5678', '+81 3-1234-5678', '+81312345678'],
		['AU', '+61 2 1234 5678', '(02) 1234 5678', '+61 2 1234 5678', '+61212345678'],
		['RU', '+7 912 345 67 89', '8 (912) 345-67-89', '+7 912 345-67-89', '+79123456789'],
		['IN', '+91 81234 56789', '081234 56789', '+91 81234 56789', '+918123456789'],
		['CN', '+86 10 1234 5678', '010 1234 5678', '+86 10 1234 5678', '+861012345678'],
		// Shared calling codes: rendered with the formats of the main territory
		['JE', '+44 7797 712345', '07797 712345', '+44 7797 712345', '+447797712345'],
		['JE', '+44 1534 456789', '01534 456789', '+44 1534 456789', '+441534456789'],
		['PR', '+1 787 234 5678', '(787) 234-5678', '+1 787-234-5678', '+17872345678'],
		['KZ', '+7 701 234 5678', '8 (701) 234 5678', '+7 701 234 5678', '+77012345678'],
	];

	it.each(CASES)('%s %s', (iso2, input, national, international, e164) => {
		// Act
		const render = (phoneOutput: PhoneParams['phoneOutput']) => formatPhone(input, { phoneOutput }).value;
		const readBack = formatPhone(national, { defaultCountry: iso2, phoneOutput: 'e164' });

		// Assert
		expect(render('national')).toBe(national);
		expect(render('international')).toBe(international);
		expect(render('e164')).toBe(e164);
		expect(readBack).toMatchObject({ status: 'ok', value: e164 });
	});
});

describe('PH-07 — the historical plans FR, US, CA are unchanged (ADR-0004)', () => {
	it('groups every French number in pairs, freephone numbers included', () => {
		// Act — libphonenumber writes `0 800 12 34 56`; the first typeVersion 6 release
		// wrote `08 00 12 34 56`, and a value already formatted stays formatted the same way
		const national = formatPhone('0800 12 34 56', { phoneOutput: 'national' });
		const international = formatPhone('0800123456', { phoneOutput: 'international' });

		// Assert
		expect(national).toMatchObject({ status: 'ok', value: '08 00 12 34 56' });
		expect(international).toMatchObject({ status: 'ok', value: '+33 8 00 12 34 56' });
	});

	it('still refuses the seven-digit Canadian service numbers, as before', () => {
		// Act — libphonenumber reads `310 1234` as a Canadian number; the first release did not
		const outcome = formatPhone('310 1234', { defaultCountry: 'CA', phoneOutput: 'e164' });

		// Assert
		expect(codes(outcome)).toEqual([FT_CODES.PHONE_LENGTH_MISMATCH]);
	});

	it('reads any ten digits as a North American number, as before', () => {
		// Act — area code 123 does not exist; the first release formatted it all the same
		const outcome = formatPhone('123 456 7890', { defaultCountry: 'US', phoneOutput: 'national' });

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: '(123) 456-7890' });
	});

	it.each([
		['0320000000', 'FR', 'national', '03 20 00 00 00'],
		['0320000000', 'FR', 'international', '+33 3 20 00 00 00'],
		['06 12 34 56 78', 'FR', 'e164', '+33612345678'],
		['(212) 555-1234', 'US', 'national', '(212) 555-1234'],
		['1 212 555 1234', 'US', 'international', '+1 212-555-1234'],
		['416 555 0199', 'CA', 'national', '(416) 555-0199'],
		['416 555 0199', 'CA', 'international', '+1 416-555-0199'],
	] as const)('%s (%s) → %s', (input, defaultCountry, phoneOutput, expected) => {
		// Act
		const outcome = formatPhone(input, { defaultCountry, phoneOutput });

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: expected });
		expect(codes(outcome)).toEqual([]);
	});

	it('now reads the national prefix written after the calling code', () => {
		// Act — `+33 (0)…` and `+1 1…` were refused; libphonenumber reads them, the node too
		const french = formatPhone('+33 (0)3 20 00 00 00', { phoneOutput: 'national' });
		const american = formatPhone('+1 1 212 555 1234', { phoneOutput: 'e164' });

		// Assert
		expect(french).toMatchObject({ status: 'ok', value: '03 20 00 00 00' });
		expect(american).toMatchObject({ status: 'ok', value: '+12125551234' });
	});
});

describe('PH-08 — reading rules and diagnostics', () => {
	it('refuses a national input without the national prefix its plan writes', () => {
		// Act — the zero lost upstream, in Britain and Germany as in France
		const british = formatPhone('20 7946 0958', { defaultCountry: 'GB' });
		const german = formatPhone('30 123456', { defaultCountry: 'DE' });

		// Assert
		expect(codes(british)).toEqual([FT_CODES.PHONE_LENGTH_MISMATCH]);
		expect(codes(german)).toEqual([FT_CODES.PHONE_LENGTH_MISMATCH]);
		expect(british.diagnostics[0].message).toContain('national prefix "0"');
	});

	it('accepts a national input without the prefix where the plan makes it optional', () => {
		// Act — in Russia the trunk `8` is optional in writing
		const outcome = formatPhone('912 345 67 89', { defaultCountry: 'RU', phoneOutput: 'e164' });

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: '+79123456789' });
	});

	it('keeps the leading zero of an Italian number, which is no national prefix', () => {
		// Act
		const outcome = formatPhone('06 1234 5678', { defaultCountry: 'IT', phoneOutput: 'e164' });

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: '+390612345678' });
	});

	it('gives a local number of a single-area territory its area code', () => {
		// Act — Antigua and Barbuda has the single area code 268
		const outcome = formatPhone('460 1234', { defaultCountry: 'AG', phoneOutput: 'e164' });

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: '+12684601234' });
	});

	it('reads a national input of a territory sharing its calling code', () => {
		// Act
		const outcome = formatPhone('787 234 5678', { defaultCountry: 'pr', phoneOutput: 'e164' });

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: '+17872345678' });
	});

	it('FT_PHONE_NOT_IN_PLAN: a possible length, but no number of the plan starts that way', () => {
		// Act — Spanish numbers start with 4 to 9
		const international = formatPhone('+34 123 456 789', {});
		const national = formatPhone('123 456 789', { defaultCountry: 'ES' });

		// Assert
		expect(international.status).toBe('failed');
		expect(international.value).toBeUndefined();
		expect(codes(international)).toEqual([FT_CODES.PHONE_NOT_IN_PLAN]);
		expect(codes(national)).toEqual([FT_CODES.PHONE_NOT_IN_PLAN]);
	});

	it('FT_PHONE_FORMAT_UNAVAILABLE: no national grouping, and the plan writes a prefix', () => {
		// Act — a German pager number: no format of the plan covers it
		const national = formatPhone('+49 16412345', { phoneOutput: 'national' });
		const international = formatPhone('+49 16412345', { phoneOutput: 'international' });
		const e164 = formatPhone('+49 16412345', { phoneOutput: 'e164' });

		// Assert — the international shape stays exact, ungrouped
		expect(codes(national)).toEqual([FT_CODES.PHONE_FORMAT_UNAVAILABLE]);
		expect(national.value).toBeUndefined();
		expect(international).toMatchObject({ status: 'ok', value: '+49 16412345' });
		expect(e164).toMatchObject({ status: 'ok', value: '+4916412345' });
	});

	it('writes the digits ungrouped in a plan without grouping nor national prefix', () => {
		// Act — the Falkland Islands: five-digit numbers, no format, no prefix
		const national = formatPhone('+500 31234', { phoneOutput: 'national' });
		const international = formatPhone('+500 31234', { phoneOutput: 'international' });

		// Assert
		expect(national).toMatchObject({ status: 'ok', value: '31234' });
		expect(international).toMatchObject({ status: 'ok', value: '+500 31234' });
	});

	it.each([
		['+800 1234 5678', 'a non-geographic service'],
		['+999 1234 5678', 'an unassigned calling code'],
	])('FT_PHONE_PLAN_UNSUPPORTED: %s (%s)', (input) => {
		// Act
		const outcome = formatPhone(input, { phoneOutput: 'e164' });

		// Assert
		expect(codes(outcome)).toEqual([FT_CODES.PHONE_PLAN_UNSUPPORTED]);
		expect(outcome.diagnostics[0].parameter).toBeUndefined();
	});

	it('a mask fits one length of a variable-length plan, and refuses the others', () => {
		// Arrange — German NSNs run from 4 to 15 digits
		const params: PhoneParams = { phoneOutput: 'mask', phoneMask: '+49 #### #######' };

		// Act
		const fits = formatPhone('01512 3456789', { ...params, defaultCountry: 'DE' });
		const refused = formatPhone('030 123456', { ...params, defaultCountry: 'DE' });

		// Assert
		expect(fits).toMatchObject({ status: 'ok', value: '+49 1512 3456789' });
		expect(codes(refused)).toEqual([FT_CODES.PHONE_LENGTH_MISMATCH]);
		expect(refused.diagnostics[0].parameter).toBe('phoneMask');
	});

	it('refuses more digits than any phone number holds, before reading any plan', () => {
		// Act
		const outcome = formatPhone('+49 1234 5678 9012 3456', { phoneOutput: 'e164' });

		// Assert
		expect(codes(outcome)).toEqual([FT_CODES.PHONE_LENGTH_MISMATCH]);
	});

	it('names the plan, never the value, in its messages (ADR-0006)', () => {
		// Act
		const outcome = formatPhone('20 7946 0958', { defaultCountry: 'GB' });

		// Assert
		expect(outcome.diagnostics[0].message).toContain('GB');
		expect(JSON.stringify(outcome.diagnostics)).not.toContain('2079460958');
	});
});

describe('PH-09 — the generated table', () => {
	const source = fs
		.readFileSync(path.join(ROOT, 'transforms', 'phone', 'numberingPlans.ts'), 'utf-8')
		.replace(/\r\n/g, '\n');
	const generator = fs.readFileSync(path.join(ROOT, 'scripts', 'gen_phone_plans.js'), 'utf-8');

	it('stays under its size budget', () => {
		// Assert — 146 kB when generated from libphonenumber 9.0.41. A jump means a
		// regeneration that changed the shape of the table: review it before raising this.
		expect(Buffer.byteLength(source, 'utf-8')).toBeLessThan(160_000);
	});

	it('is generated, at the version the generator pins, and says so', () => {
		// Act
		const pinned = /const VERSION = '([^']+)'/.exec(generator)?.[1];
		const sha = /const SHA256 = '([0-9a-f]{64})'/.exec(generator)?.[1];

		// Assert
		expect(source).toContain('DO NOT EDIT BY HAND: regenerate.');
		expect(source).toContain(`libphonenumber v${PHONE_METADATA.version}`);
		expect(PHONE_METADATA.version).toBe(pinned);
		expect(PHONE_METADATA.sha256).toBe(sha);
	});

	it('carries the attribution the Apache License 2.0 asks for, at runtime too', () => {
		// Assert — the compiled package keeps no comment: the constant is the attribution
		expect(PHONE_METADATA).toMatchObject({
			source: 'libphonenumber',
			copyright: 'Copyright (C) 2009 The Libphonenumber Authors',
			license: 'Apache-2.0',
		});
		expect(source).toContain('licensed\n * under the Apache License, Version 2.0');
		expect(source).toContain('This file\n * is a modified form of that data');
	});

	it('holds every country of the metadata, and no non-geographic service', () => {
		// Assert
		expect(Object.keys(NUMBERING_PLANS).length).toBeGreaterThanOrEqual(240);
		expect(Object.keys(NUMBERING_PLANS).every((iso2) => /^[A-Z]{2}$/.test(iso2))).toBe(true);
		for (const required of ['FR', 'US', 'CA', 'GB', 'DE', 'IT', 'ES', 'BE', 'CH', 'NL']) {
			expect(NUMBERING_PLANS[required]).toBeDefined();
		}
		expect(CALLING_CODES['800']).toBeUndefined();
	});

	it('lists each territory of a calling code once, with its own plan', () => {
		// Act
		const listed = Object.entries(CALLING_CODES).flatMap(([code, territories]) =>
			territories.map((iso2) => ({ code, iso2 })),
		);

		// Assert
		expect(listed.map(({ iso2 }) => iso2).sort()).toEqual(Object.keys(NUMBERING_PLANS).sort());
		expect(listed.filter(({ code, iso2 }) => NUMBERING_PLANS[iso2].callingCode !== code)).toEqual([]);
	});

	it('offers one `defaultCountry` option per plan, sorted by name', () => {
		// Act
		const names = PHONE_COUNTRY_OPTIONS.map((option) => option.name);

		// Assert — the order n8n's lint expects of a long options list
		expect(PHONE_COUNTRY_OPTIONS.map((option) => option.value).sort()).toEqual(
			Object.keys(NUMBERING_PLANS).sort(),
		);
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
		expect(PHONE_COUNTRY_OPTIONS).toContainEqual({ name: 'France (+33)', value: 'FR' });
		expect(PHONE_COUNTRY_OPTIONS).toContainEqual({ name: 'United States (+1)', value: 'US' });
		expect(PHONE_COUNTRY_OPTIONS).toContainEqual({ name: 'Canada (+1)', value: 'CA' });
	});
});
