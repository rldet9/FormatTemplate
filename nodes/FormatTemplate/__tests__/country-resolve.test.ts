/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals -- tests read the sources and fixtures from disk; they are never compiled into the package */
/**
 * `country` transform — v6 truth table and v5 non-regression
 *
 * @module FormatTemplate/__tests__/country-resolve
 *
 * @description
 * This file **carries over the existing tests** — the former
 * `CountryHandler.test.ts`, written on 2026-08-10 after `restcountries.com` was
 * deprecated (ADR-0009) — and adds the `onUnknown` × `acceptUnknownAlpha2`
 * truth table (ADR-0003).
 *
 * The "no network call" check is no longer a spy on the n8n context: the
 * transforms are pure and no longer receive one. It runs on the **folder**,
 * which also covers modules nobody has written yet.
 */

import * as fs from 'fs';
import * as path from 'path';

import { FT_CODES } from '../kernel/diagnostics';
import { formatCountry } from '../transforms/country/format';
import { resolveCountryV5 } from '../v5/legacyTransforms';
import { COUNTRY_NAME_TO_ISO2, ISO2_CODES, normalizeCountryKey } from '../transforms/country/countryCodes';

/** Shortcut: the value returned by v6, or `undefined`. */
const value = (input: unknown, params = {}) => formatCountry(input, params).value;

describe('CO-01 — local resolution (carried over from the former CountryHandler.test.ts)', () => {
	it.each([
		// the production case of 2026-08-10
		['Ireland', 'IE'],
		['France', 'FR'],
		['Irlande', 'IE'],
		['Allemagne', 'DE'],
		['Germany', 'DE'],
		['Belgique', 'BE'],
		['Suisse', 'CH'],
		['Espagne', 'ES'],
		['Netherlands', 'NL'],
		['Tchéquie', 'CZ'],
	])('converts %s to %s', (input, expected) => {
		expect(value(input)).toBe(expected);
	});

	it.each([
		['côte d’ivoire', 'CI'],
		["Côte d'Ivoire", 'CI'],
		['COTE D IVOIRE', 'CI'],
		['  irlande  ', 'IE'],
		['ÉTATS-UNIS', 'US'],
	])('ignores case, accents and punctuation: %s', (input, expected) => {
		expect(value(input)).toBe(expected);
	});

	it.each([
		['USA', 'US'],
		['United States of America', 'US'],
		['UK', 'GB'],
		['Great Britain', 'GB'],
		['Angleterre', 'GB'],
		['Hollande', 'NL'],
		['Ivory Coast', 'CI'],
		['République tchèque', 'CZ'],
	])('resolves the common alias %s to %s', (input, expected) => {
		expect(value(input)).toBe(expected);
	});

	it.each([
		['FR', 'FR'],
		['ie', 'IE'],
		['Be', 'BE'],
	])('passes the ISO2 code %s through', (input, expected) => {
		expect(value(input)).toBe(expected);
	});
});

describe('CO-02 — `onUnknown` × `acceptUnknownAlpha2` truth table (ADR-0003)', () => {
	/** The five inputs that exposed the silent v5 behaviour. */
	const CASES = ['', 'FR', 'France', 'ZZ', 'Bretagne'] as const;

	it.each(CASES)('"%s": no policy produces an invented value', (input) => {
		for (const onUnknown of ['error', 'keep', 'empty'] as const) {
			for (const acceptUnknownAlpha2 of [true, false]) {
				// Act
				const outcome = formatCountry(input, { onUnknown, acceptUnknownAlpha2 });

				// Assert — a value is returned only on `ok`
				if (outcome.status !== 'ok') expect(outcome.value).toBeUndefined();
				if (outcome.status !== 'ok') expect(outcome.diagnostics.length).toBeGreaterThan(0);
			}
		}
	});

	it.each([
		['error', 'failed', undefined],
		['keep', 'unchanged', undefined],
		['empty', 'ok', ''],
	] as const)('`onUnknown: %s` on an unresolved label', (onUnknown, status, expected) => {
		// Act
		const outcome = formatCountry('Bretagne', { onUnknown });

		// Assert
		expect(outcome.status).toBe(status);
		expect(outcome.value).toBe(expected);
		expect(outcome.diagnostics[0].code).toBe(FT_CODES.COUNTRY_UNKNOWN);
	});

	it('rejects a non-standard alpha-2 by default — the `ZZ` that used to pass through the whole chain', () => {
		// Act
		const outcome = formatCountry('ZZ', {});

		// Assert
		expect(outcome.status).toBe('failed');
		expect(outcome.diagnostics[0].code).toBe(FT_CODES.COUNTRY_ALPHA2_UNKNOWN);
	});

	it('lets a non-standard alpha-2 through with `acceptUnknownAlpha2`, and flags it', () => {
		// Act
		const outcome = formatCountry('zz', { acceptUnknownAlpha2: true });

		// Assert — the v5 behaviour, now explicit
		expect(outcome).toMatchObject({ status: 'ok', value: 'ZZ' });
		expect(outcome.diagnostics[0]).toMatchObject({
			code: FT_CODES.COUNTRY_ALPHA2_UNKNOWN,
			severity: 'warning',
		});
	});

	it.each(['', '   '])('leaves an empty value (%p) unchanged, and names it', (input) => {
		// Act
		const outcome = formatCountry(input, {});

		// Assert
		expect(outcome.status).toBe('unchanged');
		expect(outcome.diagnostics[0].code).toBe(FT_CODES.VALUE_EMPTY);
	});

	it('does not repeat the value in the diagnostic (ADR-0006)', () => {
		// Act
		const outcome = formatCountry('Bretagne', {});

		// Assert
		expect(JSON.stringify(outcome.diagnostics)).not.toContain('Bretagne');
	});
});

describe('CO-03 — v5 keeps its three intertwined policies (ADR-0004)', () => {
	it.each([
		['France', 'FR'],
		['fr', 'FR'],
		['ZZ', 'ZZ'],
		['', ''],
	])('"%s" stays "%s" in v5', (input, expected) => {
		// Act
		const result = resolveCountryV5(input);

		// Assert
		expect(result).toEqual({ resolved: true, value: expected });
	});

	it('"Bretagne" still fails in v5', () => {
		expect(resolveCountryV5('Bretagne')).toEqual({ resolved: false });
	});
});

describe('CO-04 — the table stays offline (historical guard of ADR-0009)', () => {
	it('no network call in the country slice', () => {
		// Arrange — the check runs on the files, not on a context spy: it also covers
		// modules that do not exist yet. Until the node had a web service, it covered the
		// whole folder; since the postal-address transformation, the folder has one
		// legitimate network access point (`adapters/n8n/`), and AR-02 keeps every other
		// file away from the network. This test keeps its original promise: the country
		// table — and the typeVersion 5 code that reads it — never go online.
		const root = path.join(__dirname, '..');
		const sources: string[] = [];
		const walk = (dir: string) => {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (/\.(ts|js)$/.test(entry.name)) sources.push(full);
			}
		};
		walk(path.join(root, 'transforms', 'country'));
		walk(path.join(root, 'v5'));

		// Act
		const offenders = sources.filter((file) =>
			/\b(fetch|axios|https?\.request|helpers\.(http)?request)\b/i.test(
				fs.readFileSync(file, 'utf-8'),
			),
		);

		// Assert
		expect(sources.length).toBeGreaterThan(5);
		expect(offenders).toEqual([]);
	});
});

describe('CO-05 — table integrity (carried over from the former CountryHandler.test.ts)', () => {
	it('contains only declared ISO2 codes', () => {
		const unknown = Object.entries(COUNTRY_NAME_TO_ISO2).filter(
			([, code]) => !ISO2_CODES.has(code),
		);
		expect(unknown).toEqual([]);
	});

	it('has only already-normalized keys', () => {
		const notNormalized = Object.keys(COUNTRY_NAME_TO_ISO2).filter(
			(k) => normalizeCountryKey(k) !== k,
		);
		expect(notNormalized).toEqual([]);
	});

	it('covers the 249 countries of ISO 3166-1', () => {
		expect(ISO2_CODES.size).toBeGreaterThanOrEqual(249);
	});

	it('exposes a name for every ISO2 code', () => {
		const resolvable = new Set(Object.values(COUNTRY_NAME_TO_ISO2));
		const orphans = [...ISO2_CODES].filter((c) => !resolvable.has(c));
		expect(orphans).toEqual([]);
	});
});
