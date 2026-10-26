/**
 * `Geocoder` port — what the postal-address transformation needs from a geocoding service
 *
 * @version 1.0.0
 * @module FormatTemplate/ports/geocoder
 *
 * @description
 * A port is an interface owned by the core (ADR-0010): the transformation
 * states what it needs, an adapter provides it. The postal-address
 * transformation consumes {@link AddressCandidate}s; the Géoplateforme adapter
 * maps the service's answer into them. Neither knows the other.
 *
 * Interfaces, types and the port's error — no implementation, no I/O, no
 * import of `n8n-workflow`.
 */

/** Precision of a candidate, from the most to the least precise. */
export type AddressPrecision = 'housenumber' | 'street' | 'locality' | 'municipality';

/**
 * One answer of a geocoding service, in the service-independent shape the
 * transformation reasons on.
 *
 * @remarks
 * Field names follow the Base Adresse Nationale vocabulary, which is also the
 * vocabulary of the French address standard. Optional fields are absent when
 * the service did not provide them — never empty strings.
 */
export interface AddressCandidate {
	/** Full label, as written by the service (`8 Boulevard du Port 80000 Amiens`). */
	label: string;
	/** Relevance score of the service, between 0 and 1. */
	score: number;
	/** Precision of the match. */
	precision: AddressPrecision;
	/** House number with its repetition index, as written by the service (`8`, `1B`, `12 bis`). */
	housenumber?: string;
	/** Street name, type included (`Boulevard du Port`). */
	street?: string;
	/** Name of the match: the street for a street, the place for a locality. */
	name?: string;
	/** Postcode (`80000`). */
	postcode?: string;
	/** Municipality (`Amiens`). */
	city?: string;
	/** INSEE code of the municipality (`80021`). */
	citycode?: string;
	/** Former municipality, for an address in a merged municipality (`Cherbourg-Octeville`). */
	oldCity?: string;
	/** District of a city with districts (`Paris 5e Arrondissement`). */
	district?: string;
	/** Context: department number, department and region names. */
	context?: string;
	/** Identifier of the address in the service. */
	id?: string;
	/** Stable national identifier of the address (Base Adresse Nationale). */
	banId?: string;
	/** WGS 84 latitude. */
	latitude?: number;
	/** WGS 84 longitude. */
	longitude?: number;
}

/**
 * A geocoding service, as the transformation sees it.
 *
 * @remarks
 * Implementations live in `adapters/`. They return the candidates **in the
 * service's order of relevance** and never throw for "no result" — an empty
 * array says it. A technical failure (timeout, unavailable service) is thrown
 * as a {@link GeocoderError}, never returned as an empty answer (ADR-0015).
 */
export interface Geocoder {
	/**
	 * Searches the addresses matching a free-text query.
	 *
	 * @param query - Query built from the input (`8 bd du Port 80000 Amiens`)
	 * @param limit - Maximum number of candidates
	 * @returns Candidates, most relevant first
	 */
	search(query: string, limit: number): Promise<AddressCandidate[]>;
}

/** Kinds of technical failure of a geocoding service. */
export type GeocoderFailure = 'unavailable' | 'rate_limited' | 'rejected';

/**
 * A technical failure of the geocoding service — never a verdict on the address.
 *
 * @remarks
 * - `unavailable`: no answer, a timeout, a 5xx status or an unreadable answer;
 * - `rate_limited`: the service asked to slow down (429);
 * - `rejected`: the service refused the request (another 4xx status).
 *
 * The first two may be retried; the third will fail again.
 */
export class GeocoderError extends Error {
	/**
	 * @param failure - Kind of failure
	 * @param message - What happened, without the query (personal data)
	 * @param retryAfterMs - Delay the service asked for, if it said one
	 */
	constructor(
		readonly failure: GeocoderFailure,
		message: string,
		readonly retryAfterMs?: number,
	) {
		super(message);
		this.name = 'GeocoderError';
	}

	/** Whether trying again may succeed. */
	get retryable(): boolean {
		return this.failure !== 'rejected';
	}
}

/** How to reach and use the geocoding service, as configured on a row. */
export interface GeocoderSettings {
	/** Base URL of the service, HTTPS (`https://data.geopf.fr/geocodage`). */
	baseUrl: string;
	/** Time allowed per request, in milliseconds. */
	timeoutMs: number;
	/** Retries after a failure that may succeed on a new attempt. */
	maxRetries: number;
	/** Maximum requests started per second. */
	requestsPerSecond: number;
}
