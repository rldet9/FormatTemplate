/**
 * Remembering the geocoder's answers for one execution
 *
 * @version 1.0.0
 * @module FormatTemplate/adapters/resilience/cache
 *
 * @description
 * A batch often carries the same address several times. The cache asks the
 * service once per distinct query — including while the first request is
 * still in flight — and keeps at most `maxEntries` answers, dropping the
 * least recently used.
 *
 * It lives **for one execution only** (ADR-0015): a cache kept at module level
 * would outlive the execution and carry addresses — personal data — from one
 * workflow to another in the same process, with no bound on memory. Failures
 * are never cached: the next item tries again.
 */

import type { AddressCandidate, Geocoder } from '../../ports/geocoder';

/** Default size of the cache. */
export const CACHE_MAX_ENTRIES = 1_000;

/**
 * Builds the cache key of a query.
 *
 * @param query - Query text
 * @param limit - Number of candidates asked for
 * @returns Key, insensitive to case and spacing
 */
function keyOf(query: string, limit: number): string {
	return `${limit}|${query.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

/**
 * Wraps a geocoder with a per-execution cache.
 *
 * @param inner - The geocoder to cache
 * @param maxEntries - Maximum number of answers kept
 * @returns A geocoder that asks once per distinct query
 *
 * @example
 * ```ts
 * const cached = withCache(geocoder);
 * await Promise.all([cached.search('12 rue de la Paix 75002 Paris', 5),
 *                    cached.search('12 RUE DE LA PAIX 75002 PARIS', 5)]); // one request
 * ```
 */
export function withCache(inner: Geocoder, maxEntries = CACHE_MAX_ENTRIES): Geocoder {
	const entries = new Map<string, Promise<AddressCandidate[]>>();
	return {
		search(query, limit) {
			const key = keyOf(query, limit);
			const known = entries.get(key);
			if (known) {
				// Least recently used last: re-insert to move it to the end.
				entries.delete(key);
				entries.set(key, known);
				return known;
			}
			const pending = inner.search(query, limit);
			entries.set(key, pending);
			pending.catch(() => {
				if (entries.get(key) === pending) entries.delete(key);
			});
			while (entries.size > maxEntries) {
				const oldest = entries.keys().next().value as string;
				entries.delete(oldest);
			}
			return pending;
		},
	};
}
