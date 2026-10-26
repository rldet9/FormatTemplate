/**
 * Retrying a geocoder after a failure that may not happen again
 *
 * @version 1.0.0
 * @module FormatTemplate/adapters/resilience/retry
 *
 * @description
 * Retries `unavailable` and `rate_limited` failures — never `rejected`, which
 * would fail again — with an exponential backoff and jitter
 * (0.5 s × 2ⁿ, ±50 %, capped at 8 s), and waits longer when the service says
 * so (`Retry-After`). A service that asks for more than 30 s is not waited
 * for: the failure is reported at once, and the node's own retry settings take
 * over (ADR-0015).
 */

import { GeocoderError, type Geocoder } from '../../ports/geocoder';
import type { Scheduler } from './scheduler';

/** Retry tuning. */
export interface RetryOptions {
	/** Retries after the first attempt. */
	maxRetries: number;
	/** First backoff delay, in milliseconds. */
	baseDelayMs: number;
	/** Maximum backoff delay, in milliseconds. */
	maxDelayMs: number;
	/** Longest `Retry-After` the decorator agrees to wait, in milliseconds. */
	maxRetryAfterMs: number;
}

/** Defaults, except `maxRetries`, which comes from the row. */
export const RETRY_DEFAULTS: Omit<RetryOptions, 'maxRetries'> = {
	baseDelayMs: 500,
	maxDelayMs: 8_000,
	maxRetryAfterMs: 30_000,
};

/**
 * Wraps a geocoder with retries.
 *
 * @param inner - The geocoder to retry
 * @param options - Retry tuning
 * @param scheduler - Clock and jitter
 * @returns A geocoder that retries
 *
 * @example
 * ```ts
 * withRetry(geocoder, { ...RETRY_DEFAULTS, maxRetries: 3 }, SYSTEM_SCHEDULER);
 * ```
 */
export function withRetry(inner: Geocoder, options: RetryOptions, scheduler: Scheduler): Geocoder {
	return {
		async search(query, limit) {
			for (let attempt = 0; ; attempt++) {
				try {
					return await inner.search(query, limit);
				} catch (error) {
					const retryable = error instanceof GeocoderError && error.retryable;
					const requested = error instanceof GeocoderError ? (error.retryAfterMs ?? 0) : 0;
					if (!retryable || attempt >= options.maxRetries || requested > options.maxRetryAfterMs) {
						throw error;
					}
					const backoff =
						Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** attempt) * (0.5 + scheduler.random() / 2);
					await scheduler.sleep(Math.max(backoff, requested));
				}
			}
		},
	};
}
