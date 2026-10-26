/**
 * The n8n HTTP adapter (N8-H*)
 *
 * @module FormatTemplate/__tests__/n8n-http-client
 *
 * @description
 * The node's single network access point goes through n8n's own helper,
 * the one the built-in nodes use, rather than a library of its own.
 */

import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';

import { createN8nHttpClient } from '../adapters/n8n/httpClient';
import { HttpTransportError } from '../ports/httpClient';

/**
 * Builds a context whose helper records the options it receives.
 *
 * @param answer - What the helper does
 * @returns The context and the recorded options
 */
function contextWith(answer: (options: IHttpRequestOptions) => Promise<unknown>) {
	const calls: IHttpRequestOptions[] = [];
	const context = {
		helpers: {
			httpRequest: async (options: IHttpRequestOptions) => {
				calls.push(options);
				return answer(options);
			},
		},
	} as unknown as IExecuteFunctions;
	return { context, calls };
}

const REQUEST = {
	url: 'https://geo.test/search',
	query: { q: '12 rue de la Paix' },
	headers: { accept: 'application/json' },
	timeoutMs: 5000,
};

describe('N8-H01 — the request', () => {
	it('asks n8n for the full answer, whatever its status, as JSON, with the timeout', async () => {
		// Arrange
		const { context, calls } = contextWith(async () => ({ statusCode: 200, headers: {}, body: {} }));

		// Act
		await createN8nHttpClient(context).get(REQUEST);

		// Assert
		expect(calls).toEqual([
			{
				method: 'GET',
				url: 'https://geo.test/search',
				qs: { q: '12 rue de la Paix' },
				headers: { accept: 'application/json' },
				timeout: 5000,
				json: true,
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
			},
		]);
	});

	it('returns status, lowercased headers and body', async () => {
		// Arrange
		const { context } = contextWith(async () => ({
			statusCode: 429,
			headers: { 'Retry-After': '2', 'X-Multi': ['a', 'b'] },
			body: { error: 'slow down' },
		}));

		// Act & Assert
		expect(await createN8nHttpClient(context).get(REQUEST)).toEqual({
			status: 429,
			headers: { 'retry-after': '2', 'x-multi': 'a' },
			body: { error: 'slow down' },
		});
	});
});

describe('N8-H02 — transport failures', () => {
	it.each([
		[{ code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' }, true],
		[{ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' }, true],
		[{ message: 'Request timeout' }, true],
		[{ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 192.0.2.10:443' }, false],
		[{ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND geo.test' }, false],
	])('maps %j to a transport error (timed out: %s)', async (failure, timedOut) => {
		// Arrange
		const { context } = contextWith(async () => {
			throw Object.assign(new Error(failure.message), failure);
		});

		// Act
		const error = await createN8nHttpClient(context)
			.get(REQUEST)
			.catch((e: unknown) => e);

		// Assert — and the message never quotes the URL, the host or the query
		expect(error).toBeInstanceOf(HttpTransportError);
		expect(error).toMatchObject({ timedOut });
		expect((error as Error).message).not.toMatch(/geo\.test|Paix|192\.0\.2\.10/);
	});
});
