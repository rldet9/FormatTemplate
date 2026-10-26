/**
 * Géoplateforme adapter — the request and every way it can fail (GP-G*)
 *
 * @module FormatTemplate/__tests__/geoplateforme-geocoder
 *
 * @description
 * ADR-0015: a technical failure is never read as "no address found". Every
 * status and transport failure becomes a typed `GeocoderError`, whose message
 * never quotes the query.
 */

import { createGeoplateformeGeocoder, parseRetryAfter, readSearchAnswer } from '../adapters/geoplateforme/geocoder';
import { GeocoderError } from '../ports/geocoder';
import { HttpTransportError, type HttpClient, type HttpRequest, type HttpResponse } from '../ports/httpClient';

const EMPTY = { type: 'FeatureCollection', features: [] };
const ONE = {
	type: 'FeatureCollection',
	features: [{ geometry: { coordinates: [2.3, 48.8] }, properties: { label: 'L', score: 0.9, type: 'street' } }],
};

/**
 * Builds a fake HTTP client.
 *
 * @param answer - What it does with a request
 * @returns The client and the requests it received
 */
function fakeHttp(answer: (request: HttpRequest) => Promise<HttpResponse>): { http: HttpClient; requests: HttpRequest[] } {
	const requests: HttpRequest[] = [];
	return {
		requests,
		http: {
			get: async (request) => {
				requests.push(request);
				return answer(request);
			},
		},
	};
}

const response = (status: number, body: unknown = EMPTY, headers: Record<string, string> = {}): HttpResponse => ({
	status,
	body,
	headers,
});

/**
 * Searches and returns the error thrown.
 *
 * @param http - Client
 * @returns The error
 */
async function failureOf(http: HttpClient): Promise<GeocoderError> {
	const geocoder = createGeoplateformeGeocoder(http, { baseUrl: 'https://geo.test/geocodage', timeoutMs: 5000 }, () => 0);
	try {
		await geocoder.search('12 rue de la Paix 75002 Paris', 5);
	} catch (error) {
		return error as GeocoderError;
	}
	throw new Error('no failure');
}

describe('GP-G01 — the request', () => {
	it('asks the address index for a complete address, without filters', async () => {
		// Arrange
		const { http, requests } = fakeHttp(async () => response(200, ONE));
		const geocoder = createGeoplateformeGeocoder(http, { baseUrl: 'https://geo.test/geocodage/', timeoutMs: 5000 });

		// Act
		const candidates = await geocoder.search('8 bd du port amiens', 5);

		// Assert
		expect(requests).toEqual([
			{
				url: 'https://geo.test/geocodage/search',
				query: { q: '8 bd du port amiens', index: 'address', limit: '5', autocomplete: '0' },
				headers: { accept: 'application/json' },
				timeoutMs: 5000,
			},
		]);
		expect(candidates).toHaveLength(1);
	});

	it('reads a body that arrived as text', async () => {
		// Assert
		expect(readSearchAnswer(response(200, JSON.stringify(ONE)), 0)).toHaveLength(1);
	});
});

describe('GP-G02 — failures are typed, never empty answers', () => {
	it.each([
		[429, 'rate_limited', true],
		[500, 'unavailable', true],
		[503, 'unavailable', true],
		[400, 'rejected', false],
		[404, 'rejected', false],
		[302, 'rejected', false],
	])('HTTP %i → %s (retryable: %s)', async (status, failure, retryable) => {
		// Act
		const error = await failureOf(fakeHttp(async () => response(status)).http);

		// Assert
		expect(error).toBeInstanceOf(GeocoderError);
		expect(error).toMatchObject({ failure, retryable });
		expect(error.message).toContain(`HTTP ${status}`);
	});

	it('carries the delay a 429 asks for', async () => {
		// Act
		const error = await failureOf(fakeHttp(async () => response(429, EMPTY, { 'retry-after': '2' })).http);

		// Assert
		expect(error.retryAfterMs).toBe(2000);
	});

	it('reads an answer that is not an address list as unavailable', async () => {
		// Act
		const error = await failureOf(fakeHttp(async () => response(200, '<html>maintenance</html>')).http);

		// Assert
		expect(error).toMatchObject({ failure: 'unavailable' });
	});

	it('reads a timeout as unavailable, naming the time allowed', async () => {
		// Act
		const error = await failureOf(
			fakeHttp(async () => {
				throw new HttpTransportError('No answer within the time allowed.', true);
			}).http,
		);

		// Assert
		expect(error).toMatchObject({ failure: 'unavailable', message: 'The geocoding service did not answer within 5000 ms.' });
	});

	it('never quotes the query in a message (ADR-0006)', async () => {
		// Act
		const messages = await Promise.all(
			[429, 503, 400].map(async (status) => (await failureOf(fakeHttp(async () => response(status)).http)).message),
		);

		// Assert
		expect(messages.join(' ')).not.toMatch(/Paix|75002/);
	});
});

describe('GP-G03 — Retry-After', () => {
	it.each([
		['3', 3000],
		[' 0 ', 0],
		[undefined, undefined],
		['soon', undefined],
	])('reads %j as %j ms', (value, expected) => {
		// Assert
		expect(parseRetryAfter(value, 0)).toBe(expected);
	});

	it('reads an HTTP date as the time left until it, never negative', () => {
		// Arrange
		const now = Date.parse('2026-10-25T10:00:00Z');

		// Assert
		expect(parseRetryAfter('Sun, 25 Oct 2026 10:00:05 GMT', now)).toBe(5000);
		expect(parseRetryAfter('Sun, 25 Oct 2026 09:00:00 GMT', now)).toBe(0);
	});
});
