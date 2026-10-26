/**
 * Parameters of the postal-address transformation and their defaults
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/postalAddress/params
 *
 * @description
 * The thresholds were **calibrated** on the recorded corpus
 * (`__tests__/fixtures/postal-address/`, 55 cases), not guessed (ADR-0013).
 * Each value sits inside the range where the corpus gives no false acceptance
 * and no false rejection; `postal-address-calibration.test.ts` keeps those
 * ranges true:
 *
 * - `minScore` 0.5 — safe from 0.30 to 0.62. The lowest correct answer scored
 *   0.620 (an address abbreviated everywhere); every wrong answer is caught by
 *   the comparison with the input even at 0.30: the score is a safety net;
 * - `ambiguityMargin` 0.05 — safe from 0.005 to 0.5. Truly ambiguous answers
 *   (`1 rue de la Gare`, no town) differ by less than 0.005; a wider margin
 *   costs nothing, because a rival must also match the input;
 * - `streetSimilarity` 0.8 — must exceed 2/3: at 0.6 the corpus accepts
 *   `rue de la Paix Royale` as "Rue de la Paix" (one shared word in three). No
 *   case bounds it from above; 0.8 still tolerates one differing word in five.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import type { AddressPrecision, GeocoderSettings } from '../../ports/geocoder';
import type { DecisionOptions } from './decide';
import type { PostalLinesOptions } from './postalLines';

/** Base URL of the public Géoplateforme geocoding service. */
export const DEFAULT_GEOCODER_URL = 'https://data.geopf.fr/geocodage';

/** Shape of the value written back. */
export type AddressOutputFormat = 'postalLines' | 'label' | 'structured';

/** Resolved parameters. */
export interface PostalAddressSettings extends DecisionOptions, PostalLinesOptions, GeocoderSettings {
	outputFormat: AddressOutputFormat;
	/** Accept an address the geocoder corrected (postcode, city, street spelling). */
	acceptCorrections: boolean;
}

/** Defaults — see the calibration notes above. */
export const ADDRESS_DEFAULTS: Readonly<PostalAddressSettings> = {
	outputFormat: 'postalLines',
	minimumPrecision: 'housenumber',
	acceptCorrections: true,
	includeCountryLine: false,
	stripAccents: true,
	minScore: 0.5,
	ambiguityMargin: 0.05,
	streetSimilarity: 0.8,
	baseUrl: DEFAULT_GEOCODER_URL,
	timeoutMs: 10_000,
	maxRetries: 3,
	requestsPerSecond: 40,
};

const OUTPUT_FORMATS: readonly AddressOutputFormat[] = ['postalLines', 'label', 'structured'];
const PRECISIONS: readonly AddressPrecision[] = ['housenumber', 'street', 'locality', 'municipality'];

/**
 * Reads a number between 0 and 1.
 *
 * @param value - Raw value
 * @param fallback - Default
 * @returns The value, or the default if it is not a number in [0, 1]
 */
function ratio(value: unknown, fallback: number): number {
	const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	return typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1
		? number
		: fallback;
}

/**
 * Reads a whole number within bounds.
 *
 * @param value - Raw value
 * @param min - Lowest accepted value
 * @param max - Highest accepted value
 * @param fallback - Default, for a value that is not a number
 * @returns The value, rounded and clamped to [min, max], or the default
 */
function bounded(value: unknown, min: number, max: number, fallback: number): number {
	const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	if (typeof number !== 'number' || !Number.isFinite(number)) return fallback;
	return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * Resolves the parameters of a row, defaults included.
 *
 * @param row - Row parameters, as configured; the tuning options may sit in
 *              the row's `advanced` collection
 * @returns Complete settings
 *
 * @example
 * ```ts
 * resolveAddressSettings({ outputFormat: 'structured', minScore: 0.6 });
 * // { ...ADDRESS_DEFAULTS, outputFormat: 'structured', minScore: 0.6 }
 * ```
 */
export function resolveAddressSettings(row: Record<string, unknown>): PostalAddressSettings {
	const advanced = row.advanced && typeof row.advanced === 'object' ? (row.advanced as Record<string, unknown>) : {};
	const params: Record<string, unknown> = { ...row, ...advanced };
	const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
		allowed.includes(value as T) ? (value as T) : fallback;
	const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
	return {
		outputFormat: pick(params.outputFormat, OUTPUT_FORMATS, ADDRESS_DEFAULTS.outputFormat),
		minimumPrecision: pick(params.minimumPrecision, PRECISIONS, ADDRESS_DEFAULTS.minimumPrecision),
		acceptCorrections: flag(params.acceptCorrections, ADDRESS_DEFAULTS.acceptCorrections),
		includeCountryLine: flag(params.includeCountryLine, ADDRESS_DEFAULTS.includeCountryLine),
		stripAccents: flag(params.stripAccents, ADDRESS_DEFAULTS.stripAccents),
		minScore: ratio(params.minScore, ADDRESS_DEFAULTS.minScore),
		ambiguityMargin: ratio(params.ambiguityMargin, ADDRESS_DEFAULTS.ambiguityMargin),
		streetSimilarity: ratio(params.streetSimilarity, ADDRESS_DEFAULTS.streetSimilarity),
		baseUrl:
			typeof params.baseUrl === 'string' && params.baseUrl.trim() !== ''
				? params.baseUrl.trim()
				: ADDRESS_DEFAULTS.baseUrl,
		timeoutMs: bounded(params.timeoutMs, 1_000, 60_000, ADDRESS_DEFAULTS.timeoutMs),
		maxRetries: bounded(params.maxRetries, 0, 5, ADDRESS_DEFAULTS.maxRetries),
		// The public service accepts 50 requests per second and per IP address.
		requestsPerSecond: bounded(params.requestsPerSecond, 1, 50, ADDRESS_DEFAULTS.requestsPerSecond),
	};
}
