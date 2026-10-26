/**
 * `postalAddress` module — French postal address verification and formatting
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/postalAddress/module
 *
 * @description
 * Assembles the `postalAddress` slice: interface, codes, the configuration
 * check of the service URL, and `run`, which chains the pure steps around the
 * one lookup — through the `Geocoder` of the execution context:
 *
 * ```text
 * parseInput → geocoder.search → evaluateAddress (decide → postalLines)
 * ```
 *
 * A technical failure of the service becomes a technical diagnostic, which
 * the engine handles with the row's `onServiceError` (ADR-0015); a refusal of
 * the address is a data diagnostic, handled with `onFieldError`.
 *
 * Pure module — no runtime import of `n8n-workflow`; the network is reached
 * through the context only.
 */

import { ftDiagnostic, FT_CODES, type FtDiagnostic } from '../../kernel/diagnostics';
import { outcomeFailed, outcomeUnchanged } from '../../kernel/outcome';
import type { TransformModule } from '../../kernel/transformModule';
import { GeocoderError } from '../../ports/geocoder';
import type { TransformContext } from '../../ports/transformContext';
import { ADDRESS_CODES } from './codes';
import { evaluateAddress } from './evaluate';
import { resolveAddressSettings } from './params';
import { parseAddressInput } from './parseInput';
import { POSTAL_ADDRESS_PROPERTIES } from './properties';

/** Number of candidates asked of the geocoder: enough to see a rival. */
const CANDIDATES = 5;

/** Diagnostic code of each kind of service failure. */
const FAILURE_CODES = {
	unavailable: ADDRESS_CODES.SERVICE_UNAVAILABLE,
	rate_limited: ADDRESS_CODES.RATE_LIMITED,
	rejected: ADDRESS_CODES.SERVICE_REJECTED,
} as const;

/**
 * Checks the service URL — a **configuration** error otherwise.
 *
 * @param url - Configured base URL
 * @returns Diagnostic if the URL is not an absolute HTTPS URL, otherwise `undefined`
 *
 * @example
 * ```ts
 * validateServiceUrl('https://data.geopf.fr/geocodage'); // undefined
 * validateServiceUrl('http://example.org');              // FT_ADDRESS_ENDPOINT_INVALID
 * ```
 */
export function validateServiceUrl(url: string): FtDiagnostic | undefined {
	let parsed: URL | undefined;
	try {
		parsed = new URL(url);
	} catch {
		parsed = undefined;
	}
	if (parsed?.protocol === 'https:' && parsed.hostname !== '') return undefined;
	return ftDiagnostic(
		ADDRESS_CODES.ENDPOINT_INVALID,
		'The geocoding service URL must be an absolute HTTPS URL.',
		{ parameter: 'advanced.baseUrl' },
	);
}

/** The `postalAddress` transformation. */
export const postalAddressModule: TransformModule<TransformContext> = {
	type: 'postalAddress',
	displayName: 'Postal Address (France)',
	description:
		'Verify a French address against the national address base and write it to the postal standard (NF Z10-011)',
	properties: POSTAL_ADDRESS_PROPERTIES,
	codes: [
		FT_CODES.VALUE_EMPTY,
		...Object.values(ADDRESS_CODES),
	],
	validateRow(row) {
		// Only a literal URL can be judged before the loop; an expression waits for its item.
		const advanced = row.advanced as Record<string, unknown> | undefined;
		const url = advanced?.baseUrl;
		if (typeof url !== 'string' || url.trim() === '' || url.startsWith('=')) return undefined;
		return validateServiceUrl(url.trim());
	},
	async run(value, params, context) {
		const parsed = parseAddressInput(value);
		if (!parsed.ok) {
			return parsed.status === 'unchanged'
				? outcomeUnchanged([parsed.diagnostic])
				: outcomeFailed([parsed.diagnostic]);
		}

		const settings = resolveAddressSettings(params);
		const invalidUrl = validateServiceUrl(settings.baseUrl);
		if (invalidUrl) return outcomeFailed([invalidUrl]);

		let candidates;
		try {
			candidates = await context.geocoder(settings).search(parsed.address.query, CANDIDATES);
		} catch (error) {
			if (!(error instanceof GeocoderError)) throw error;
			return outcomeFailed([ftDiagnostic(FAILURE_CODES[error.failure], error.message)]);
		}
		return evaluateAddress(parsed.address, candidates, settings);
	},
};
