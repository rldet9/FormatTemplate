/**
 * Assembling the geocoder of an execution
 *
 * @version 1.0.0
 * @module FormatTemplate/adapters/geocoding
 *
 * @description
 * One place composes the geocoding stack (ADR-0015):
 *
 * ```text
 * cache → retry → rate limit → Géoplateforme → HttpClient
 * ```
 *
 * - the **cache** comes first, so that a repeated address costs nothing —
 *   not even a slot of the rate limit;
 * - **retry** wraps the rate limit, so that every new attempt queues like any
 *   request;
 * - the **rate limit** is closest to the service it protects.
 *
 * Rows may configure different services or limits: one stack is built per
 * distinct configuration, and shared by every item of the execution.
 */

import { createGeoplateformeGeocoder } from './geoplateforme/geocoder';
import { withCache } from './resilience/cache';
import { withRateLimit } from './resilience/rateLimit';
import { RETRY_DEFAULTS, withRetry } from './resilience/retry';
import type { Scheduler } from './resilience/scheduler';
import type { Geocoder, GeocoderSettings } from '../ports/geocoder';
import type { HttpClient } from '../ports/httpClient';

/** Gives the geocoder of a configuration; the same one for the same configuration. */
export type GeocoderProvider = (settings: GeocoderSettings) => Geocoder;

/**
 * Builds the geocoder provider of one execution.
 *
 * @param http - HTTP client of the execution
 * @param scheduler - Clock and jitter
 * @returns Provider, memoized by configuration
 *
 * @example
 * ```ts
 * const geocoderFor = createGeocoderProvider(createN8nHttpClient(this), SYSTEM_SCHEDULER);
 * const geocoder = geocoderFor({ baseUrl, timeoutMs: 10_000, maxRetries: 3, requestsPerSecond: 40 });
 * ```
 */
export function createGeocoderProvider(http: HttpClient, scheduler: Scheduler): GeocoderProvider {
	const stacks = new Map<string, Geocoder>();
	return (settings) => {
		const key = JSON.stringify([
			settings.baseUrl,
			settings.timeoutMs,
			settings.maxRetries,
			settings.requestsPerSecond,
		]);
		let stack = stacks.get(key);
		if (!stack) {
			const service = createGeoplateformeGeocoder(http, settings, () => scheduler.now());
			const limited = withRateLimit(service, settings.requestsPerSecond, scheduler);
			const retried = withRetry(limited, { ...RETRY_DEFAULTS, maxRetries: settings.maxRetries }, scheduler);
			stack = withCache(retried);
			stacks.set(key, stack);
		}
		return stack;
	};
}
