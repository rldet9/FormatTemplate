/**
 * `HttpClient` port — the one way the node talks to a web service
 *
 * @version 1.0.0
 * @module FormatTemplate/ports/httpClient
 *
 * @description
 * ADR-0015. The geocoding adapter does not know how requests are sent; it is
 * given an `HttpClient`. In the node, the client is built on n8n's own
 * `helpers.httpRequest`; in the tests, it is a fake that serves recorded
 * answers.
 *
 * Interfaces and a transport error only — no implementation, no import of
 * `n8n-workflow`.
 */

/** A GET request. */
export interface HttpRequest {
	/** Absolute URL, without the query string. */
	url: string;
	/** Query-string parameters. */
	query?: Readonly<Record<string, string>>;
	/** Headers to send. */
	headers?: Readonly<Record<string, string>>;
	/** Time allowed for the whole exchange, in milliseconds. */
	timeoutMs: number;
}

/** An HTTP answer, whatever its status. */
export interface HttpResponse {
	/** HTTP status code. */
	status: number;
	/** Headers, names in lowercase. */
	headers: Readonly<Record<string, string | undefined>>;
	/** Body, parsed as JSON when possible. */
	body: unknown;
}

/**
 * Sends requests.
 *
 * @remarks
 * An HTTP error status is **not** an exception: it is an answer, returned with
 * its status, for the caller to interpret. Only a transport failure — no
 * connection, no answer in time — throws, as {@link HttpTransportError}.
 */
export interface HttpClient {
	/**
	 * Sends a GET request.
	 *
	 * @param request - The request
	 * @returns The answer, whatever its status
	 * @throws HttpTransportError when no answer was received
	 */
	get(request: HttpRequest): Promise<HttpResponse>;
}

/** No answer was received: connection refused, DNS failure, timeout. */
export class HttpTransportError extends Error {
	/**
	 * @param message - What happened, without the request's query (personal data)
	 * @param timedOut - `true` when the time allowed ran out
	 */
	constructor(
		message: string,
		readonly timedOut: boolean,
	) {
		super(message);
		this.name = 'HttpTransportError';
	}
}
