/**
 * The Géoplateforme geocoding service, as a `Geocoder`
 *
 * @version 1.0.0
 * @module FormatTemplate/adapters/geoplateforme/geocoder
 *
 * @description
 * Free geocoding service of the French State (IGN, `data.geopf.fr/geocodage`),
 * successor of the "API Adresse" — whose former host has answered with a
 * `Sunset` header since 2026-01-31 and must not be used. No account, no key;
 * 50 requests per second and per IP address.
 *
 * Request: `GET {baseUrl}/search?q=…&index=address&limit=…&autocomplete=0`.
 * `autocomplete=0` because a complete address is being checked, not a text
 * being typed; no `postcode` filter, because it would prevent correcting a
 * wrong postcode (ADR-0013).
 *
 * Every way the exchange can go wrong becomes a typed {@link GeocoderError}:
 * a technical failure is never read as "no address found" (ADR-0015).
 */

import {
	GeocoderError,
	type AddressCandidate,
	type Geocoder,
	type GeocoderSettings,
} from '../../ports/geocoder';
import { HttpTransportError, type HttpClient, type HttpResponse } from '../../ports/httpClient';
import { mapSearchResponse } from './mapResponse';

/**
 * Reads a `Retry-After` header: a number of seconds, or an HTTP date.
 *
 * @param value - Header value
 * @param now - Current time, in milliseconds
 * @returns Delay in milliseconds, or `undefined`
 *
 * @example
 * ```ts
 * parseRetryAfter('2', Date.now());                         // 2000
 * parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT', now);    // ms until that date
 * ```
 */
export function parseRetryAfter(value: string | undefined, now: number): number | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
	const date = Date.parse(trimmed);
	return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/**
 * Reads a body that may have arrived as text.
 *
 * @param body - Body of the answer
 * @returns Parsed JSON, or the body as is
 */
function parsedBody(body: unknown): unknown {
	if (typeof body !== 'string') return body;
	try {
		return JSON.parse(body) as unknown;
	} catch {
		return body;
	}
}

/**
 * Turns an HTTP answer into candidates, or into the failure it denotes.
 *
 * @param response - The answer
 * @param now - Current time, to read a dated `Retry-After`
 * @returns Candidates
 * @throws GeocoderError for any status other than 2xx, or an unreadable body
 */
export function readSearchAnswer(response: HttpResponse, now: number): AddressCandidate[] {
	const retryAfterMs = parseRetryAfter(response.headers['retry-after'], now);
	if (response.status === 429) {
		throw new GeocoderError('rate_limited', 'The geocoding service asked to slow down (HTTP 429).', retryAfterMs);
	}
	if (response.status >= 500) {
		throw new GeocoderError(
			'unavailable',
			`The geocoding service is unavailable (HTTP ${response.status}).`,
			retryAfterMs,
		);
	}
	if (response.status < 200 || response.status >= 300) {
		throw new GeocoderError('rejected', `The geocoding service refused the request (HTTP ${response.status}).`);
	}
	try {
		return mapSearchResponse(parsedBody(response.body));
	} catch {
		throw new GeocoderError('unavailable', 'The geocoding service gave an answer that is not an address list.');
	}
}

/**
 * Builds a `Geocoder` on the Géoplateforme service.
 *
 * @param http - HTTP client
 * @param settings - Base URL and time allowed per request
 * @param now - Clock, injectable for tests
 * @returns The geocoder
 *
 * @example
 * ```ts
 * const geocoder = createGeoplateformeGeocoder(http, { baseUrl: 'https://data.geopf.fr/geocodage', timeoutMs: 10_000 });
 * await geocoder.search('8 bd du port amiens', 5);
 * ```
 */
export function createGeoplateformeGeocoder(
	http: HttpClient,
	settings: Pick<GeocoderSettings, 'baseUrl' | 'timeoutMs'>,
	now: () => number = Date.now,
): Geocoder {
	const url = `${settings.baseUrl.replace(/\/+$/, '')}/search`;
	return {
		async search(query: string, limit: number): Promise<AddressCandidate[]> {
			let response: HttpResponse;
			try {
				response = await http.get({
					url,
					query: { q: query, index: 'address', limit: String(limit), autocomplete: '0' },
					headers: { accept: 'application/json' },
					timeoutMs: settings.timeoutMs,
				});
			} catch (error) {
				const timedOut = error instanceof HttpTransportError && error.timedOut;
				throw new GeocoderError(
					'unavailable',
					timedOut
						? `The geocoding service did not answer within ${settings.timeoutMs} ms.`
						: 'The geocoding service could not be reached.',
				);
			}
			return readSearchAnswer(response, now());
		},
	};
}
