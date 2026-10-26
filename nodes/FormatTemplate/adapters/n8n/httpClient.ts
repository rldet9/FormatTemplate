/**
 * `HttpClient` on n8n's own HTTP helper — the node's single network access point
 *
 * @version 1.0.0
 * @module FormatTemplate/adapters/n8n/httpClient
 *
 * @description
 * ADR-0015: this is the only file of the folder allowed to open a connection
 * (architecture test AR-02). It goes through `helpers.httpRequest`, the
 * helper n8n's built-in nodes use, rather than a library of its own: no
 * runtime dependency (ADR-0005), and the request takes the same path as
 * theirs.
 *
 * HTTP error statuses come back as answers (`ignoreHttpStatusErrors`), for the
 * service adapter to interpret; only a transport failure throws, as an
 * `HttpTransportError` that never quotes the request.
 */

import type { IDataObject, IExecuteFunctions, IN8nHttpFullResponse } from 'n8n-workflow';

import { HttpTransportError, type HttpClient, type HttpResponse } from '../../ports/httpClient';

/** Error codes that mean the time allowed ran out. */
const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT']);

/**
 * Lowercases header names and keeps their first value.
 *
 * @param headers - Headers as returned by n8n
 * @returns Headers, names in lowercase
 */
function normalizeHeaders(headers: IDataObject | undefined): Record<string, string | undefined> {
	const result: Record<string, string | undefined> = {};
	for (const [name, value] of Object.entries(headers ?? {})) {
		const first = Array.isArray(value) ? value[0] : value;
		result[name.toLowerCase()] = first === undefined || first === null ? undefined : String(first);
	}
	return result;
}

/**
 * Builds an `HttpClient` on an n8n execution context.
 *
 * @param context - n8n execution context
 * @returns The client
 *
 * @example
 * ```ts
 * const http = createN8nHttpClient(this);
 * ```
 */
export function createN8nHttpClient(context: IExecuteFunctions): HttpClient {
	return {
		async get(request): Promise<HttpResponse> {
			try {
				const response = (await context.helpers.httpRequest({
					method: 'GET',
					url: request.url,
					qs: { ...request.query },
					headers: { ...request.headers },
					timeout: request.timeoutMs,
					json: true,
					returnFullResponse: true,
					ignoreHttpStatusErrors: true,
				})) as IN8nHttpFullResponse;
				return {
					status: response.statusCode,
					headers: normalizeHeaders(response.headers),
					body: response.body,
				};
			} catch (error) {
				const code = (error as { code?: unknown })?.code;
				const message = String((error as { message?: unknown })?.message ?? '');
				const timedOut = (typeof code === 'string' && TIMEOUT_CODES.has(code)) || /timeout/i.test(message);
				throw new HttpTransportError(
					timedOut ? 'No answer within the time allowed.' : 'The service could not be reached.',
					timedOut,
				);
			}
		},
	};
}
