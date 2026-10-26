/**
 * Spacing the requests to a geocoder
 *
 * @version 1.0.0
 * @module FormatTemplate/adapters/resilience/rateLimit
 *
 * @description
 * The public Géoplateforme service accepts 50 requests per second and per IP
 * address. The node starts at most `requestsPerSecond` (40 by default) by
 * spacing request starts evenly: each request books the next free slot and
 * waits for it. Concurrent callers queue in booking order.
 */

import type { Geocoder } from '../../ports/geocoder';
import type { Scheduler } from './scheduler';

/**
 * Wraps a geocoder with a request-rate limit.
 *
 * @param inner - The geocoder to limit
 * @param requestsPerSecond - Maximum request starts per second; 0 or less disables the limit
 * @param scheduler - Clock
 * @returns A geocoder that never starts requests faster than the limit
 *
 * @example
 * ```ts
 * withRateLimit(geocoder, 40, SYSTEM_SCHEDULER); // one request start every 25 ms at most
 * ```
 */
export function withRateLimit(inner: Geocoder, requestsPerSecond: number, scheduler: Scheduler): Geocoder {
	if (!(requestsPerSecond > 0)) return inner;
	const interval = 1000 / requestsPerSecond;
	let nextSlot = Number.NEGATIVE_INFINITY;
	return {
		async search(query, limit) {
			const now = scheduler.now();
			const start = Math.max(now, nextSlot);
			nextSlot = start + interval;
			if (start > now) await scheduler.sleep(start - now);
			return inner.search(query, limit);
		},
	};
}
