/**
 * Conversion to an ISO 3166-1 alpha-2 code — the pure function of typeVersion 6
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/country/format
 *
 * @description
 * typeVersion 5 took **three different decisions** in the same function,
 * none of which the user could choose: pass-through for an empty value,
 * pass-through in uppercase for an alpha-2 code outside the standard
 * ("historical compatibility of internal codes"), and an exception for
 * everything else — an exception that, lacking a per-item loop, destroyed the
 * whole batch.
 *
 * The two halves of the defect compensated each other in the statistics: a
 * `ZZ` travelled down the chain as if it were a country, while a French region
 * (`Bretagne`) stopped a production batch.
 *
 * typeVersion 6 exposes **a single** policy, `onUnknown`, and refuses alpha-2
 * codes outside the standard by default (ADR-0003).
 *
 * The table stays **offline** (ADR-0009): on 2026-08-10 the deprecation of
 * `restcountries.com` made every conversion of a full name fail, "France"
 * included. Never reintroduce a network call; a test checks it.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { FT_CODES, ftDiagnostic } from '../../kernel/diagnostics';
import {
	outcomeFailed,
	outcomeOk,
	outcomeUnchanged,
	type FormatOutcome,
} from '../../kernel/outcome';
import { COUNTRY_NAME_TO_ISO2, ISO2_CODES, normalizeCountryKey } from './countryCodes';

/** Policy applied to a value the table does not resolve. */
export type CountryUnknownPolicy = 'error' | 'keep' | 'empty';

/** Parameters of a `country` row in typeVersion 6. */
export interface CountryParams {
	/** Policy for an unresolved value; `error` by default. */
	onUnknown?: CountryUnknownPolicy;
	/**
	 * Lets a two-letter code absent from the standard through, in uppercase.
	 *
	 * @remarks
	 * This was the historical behaviour of typeVersion 5, made **explicit** and
	 * off by default: it is what let a `ZZ` travel down the chain.
	 */
	acceptUnknownAlpha2?: boolean;
}

/**
 * Applies the `onUnknown` policy to an unresolved value.
 *
 * @param policy - Configured policy
 * @param code - Diagnostic code to raise
 * @param message - Diagnostic message
 * @returns Typed result
 */
function applyUnknownPolicy(
	policy: CountryUnknownPolicy,
	code: string,
	message: string,
): FormatOutcome {
	const diagnostic = ftDiagnostic(code, message, {
		parameter: 'onUnknown',
		severity: policy === 'error' ? 'error' : 'warning',
	});
	switch (policy) {
		case 'keep':
			return outcomeUnchanged([diagnostic]);
		case 'empty':
			return outcomeOk('', [diagnostic]);
		case 'error':
		default:
			return outcomeFailed([diagnostic]);
	}
}

/**
 * Converts a country name to an ISO 3166-1 alpha-2 code — pure function of typeVersion 6.
 *
 * @param value - Value read from the item, unconverted
 * @param params - Row parameters (`onUnknown`, `acceptUnknownAlpha2`)
 * @returns Typed result
 *
 * @example
 * ```ts
 * formatCountry('France', {});                 // { status: 'ok', value: 'FR' }
 * formatCountry('Bretagne', {});               // { status: 'failed', … FT_COUNTRY_UNKNOWN }
 * formatCountry('Bretagne', { onUnknown: 'keep' }); // { status: 'unchanged', … }
 * formatCountry('ZZ', { acceptUnknownAlpha2: true }); // { status: 'ok', value: 'ZZ' }
 * ```
 */
export function formatCountry(value: unknown, params: CountryParams = {}): FormatOutcome {
	const policy: CountryUnknownPolicy = params.onUnknown ?? 'error';
	const trimmed = (value === undefined || value === null ? '' : String(value)).trim();

	// Empty: behaviour kept — but named.
	if (trimmed === '') {
		return outcomeUnchanged([
			ftDiagnostic(FT_CODES.VALUE_EMPTY, 'Empty value: no country to convert.', {
				severity: 'info',
			}),
		]);
	}

	// 1. Already an ISO2 code in force.
	const upper = trimmed.toUpperCase();
	if (ISO2_CODES.has(upper)) {
		return outcomeOk(upper);
	}

	// 2. Country name (French, English or common alias) — also covers the
	//    out-of-standard codes still in use, "UK" first, which must become "GB".
	const fromName = COUNTRY_NAME_TO_ISO2[normalizeCountryKey(trimmed)];
	if (fromName) {
		return outcomeOk(fromName);
	}

	// 3. Two letters outside the standard: refused by default in typeVersion 6.
	if (/^[a-zA-Z]{2}$/.test(trimmed)) {
		if (params.acceptUnknownAlpha2) {
			return outcomeOk(upper, [
				ftDiagnostic(
					FT_CODES.COUNTRY_ALPHA2_UNKNOWN,
					'Two-letter code outside the standard, kept in uppercase (acceptUnknownAlpha2 enabled).',
					{ parameter: 'acceptUnknownAlpha2', severity: 'warning' },
				),
			]);
		}
		return applyUnknownPolicy(
			policy,
			FT_CODES.COUNTRY_ALPHA2_UNKNOWN,
			'The value is a two-letter code absent from ISO 3166-1. Enable ' +
				'acceptUnknownAlpha2 to let internal codes through.',
		);
	}

	// ADR-0006: the message does not repeat the value — it is only written to
	// `_format` under `options.traceValues`, explicitly.
	return applyUnknownPolicy(
		policy,
		FT_CODES.COUNTRY_UNKNOWN,
		'No ISO 3166-1 match. The embedded table covers French and English names and common ' +
			'aliases; check the spelling or provide the two-letter code directly.',
	);
}
