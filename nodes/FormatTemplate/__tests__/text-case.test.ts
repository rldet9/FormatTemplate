/**
 * v6 `textCase` transform — pure module
 *
 * @module FormatTemplate/__tests__/text-case
 *
 * @description
 * Four modes × locale, non-text value. The acceptance criterion is checked
 * word for word, `capitalize` included — it must return **exactly** what v5
 * returns (ADR-0004).
 */

import { FT_CODES } from '../kernel/diagnostics';
import { formatTextCase, toTitleCase } from '../transforms/textCase/format';
import { formatTextCaseV5 } from '../v5/legacyTransforms';

describe('TC-01 — the four modes', () => {
	it.each([
		['uppercase', 'Studio Belleville', 'STUDIO BELLEVILLE'],
		['lowercase', 'Studio Belleville', 'studio belleville'],
		['capitalize', 'STUDIO BELLEVILLE', 'Studio belleville'],
		['titleCase', 'STUDIO BELLEVILLE', 'Studio Belleville'],
	] as const)('%s: "%s" becomes "%s"', (mode, input, expected) => {
		// Act
		const outcome = formatTextCase(input, { textCase: mode });

		// Assert
		expect(outcome).toMatchObject({ status: 'ok', value: expected });
	});

	it('`uppercase` stays the default mode, as in v5', () => {
		// Act & Assert
		expect(formatTextCase('durand', {}).value).toBe('DURAND');
	});
});

describe('TC-02 — `titleCase` acceptance criterion', () => {
	it.each([
		['SARL DUPONT ET FILS', 'Sarl Dupont Et Fils'],
		["jean-pierre o'brien", "Jean-Pierre O'Brien"],
		['élise durand', 'Élise Durand'],
	])('"%s" becomes "%s"', (input, expected) => {
		// Act & Assert
		expect(formatTextCase(input, { textCase: 'titleCase' }).value).toBe(expected);
	});

	it.each([
		['s.a.r.l dupont', 'S.A.R.L Dupont'],
		['transport nord/sud', 'Transport Nord/Sud'],
		['studio (belleville)', 'Studio (Belleville)'],
		['jean-pierre o’brien', 'Jean-Pierre O’Brien'],
	])('capitalizes again after each documented separator: "%s"', (input, expected) => {
		// Act & Assert
		expect(toTitleCase(input, 'fr-FR')).toBe(expected);
	});

	it('applies no name-particle rule — documented, hence predictable', () => {
		// Assert — `de` stays capitalized: no implicit list of particles
		expect(toTitleCase('jean de la fontaine', 'fr-FR')).toBe('Jean De La Fontaine');
	});
});

describe('TC-03 — `capitalize` returns exactly what v5 returns (ADR-0004)', () => {
	it.each([
		'STUDIO BELLEVILLE',
		'ÉLISE DURAND',
		'SARL DUPONT ET FILS',
		'jean-pierre',
		'é',
	])('"%s"', (input) => {
		// Act
		const v6 = formatTextCase(input, { textCase: 'capitalize' });

		// Assert
		expect(v6.value).toBe(formatTextCaseV5(input, 'capitalize'));
	});
});

describe('TC-04 — locale', () => {
	it('uses `fr-FR` by default', () => {
		// Act & Assert
		expect(formatTextCase('istanbul', { textCase: 'uppercase' }).value).toBe('ISTANBUL');
	});

	it('honours an explicit locale', () => {
		// Act — in Turkish, uppercase `i` is `İ`
		const outcome = formatTextCase('istanbul', { textCase: 'uppercase', locale: 'tr-TR' });

		// Assert
		expect(outcome.value).toBe('İSTANBUL');
	});

	it('falls back to `fr-FR` when the locale is empty', () => {
		// Act & Assert
		expect(formatTextCase('istanbul', { textCase: 'uppercase', locale: '  ' }).value).toBe(
			'ISTANBUL',
		);
	});
});

describe('TC-05 — non-text value and empty value', () => {
	it.each([[42], [true], [{ nom: 'Durand' }], [['a']]])('rejects a non-text value: %p', (input) => {
		// Act
		const outcome = formatTextCase(input, { textCase: 'uppercase' });

		// Assert — v5 returned it as is, silently
		expect(outcome.status).toBe('failed');
		expect(outcome.diagnostics[0].code).toBe(FT_CODES.TEXT_NOT_STRING);
	});

	it('does not repeat the value in the diagnostic (ADR-0006)', () => {
		// Act
		const outcome = formatTextCase(1234567890, { textCase: 'uppercase' });

		// Assert
		expect(JSON.stringify(outcome.diagnostics)).not.toContain('1234567890');
	});

	it('leaves an empty string unchanged, and says so', () => {
		// Act
		const outcome = formatTextCase('', { textCase: 'uppercase' });

		// Assert
		expect(outcome.status).toBe('unchanged');
		expect(outcome.diagnostics[0].code).toBe(FT_CODES.VALUE_EMPTY);
	});
});
