/* eslint-disable @n8n/community-nodes/no-restricted-globals -- the pool test waits on real timers; tests are never compiled into the package */
/**
 * Resilience of the geocoding stack (RS-*)
 *
 * @module FormatTemplate/__tests__/resilience
 *
 * @description
 * ADR-0015. Retry, rate limit and cache are decorators of the `Geocoder` port;
 * they run here on a simulated clock — instantly, deterministically.
 */

import { createGeocoderProvider } from '../adapters/geocoding';
import { CACHE_MAX_ENTRIES, withCache } from '../adapters/resilience/cache';
import { withRateLimit } from '../adapters/resilience/rateLimit';
import { RETRY_DEFAULTS, withRetry } from '../adapters/resilience/retry';
import type { Scheduler } from '../adapters/resilience/scheduler';
import { mapWithConcurrency } from '../engine/pool';
import { GeocoderError, type AddressCandidate, type Geocoder } from '../ports/geocoder';

/**
 * A simulated clock: `sleep` records the delay and moves time forward.
 *
 * @returns The scheduler and the recorded delays
 */
function simulatedScheduler(): Scheduler & { sleeps: number[]; time: number } {
	const scheduler = {
		time: 0,
		sleeps: [] as number[],
		now: () => scheduler.time,
		sleep: async (ms: number) => {
			scheduler.sleeps.push(ms);
			scheduler.time += ms;
		},
		random: () => 0.5, // jitter factor 0.5 + 0.5 / 2 = 0.75
	};
	return scheduler;
}

/**
 * A geocoder that plays a script of answers and failures.
 *
 * @param script - One entry per call: candidates, or an error to throw
 * @returns The geocoder and its calls
 */
function scripted(script: Array<AddressCandidate[] | Error>): Geocoder & { calls: string[] } {
	const geocoder = {
		calls: [] as string[],
		async search(query: string) {
			geocoder.calls.push(query);
			const next = script[Math.min(geocoder.calls.length - 1, script.length - 1)];
			if (next instanceof Error) throw next;
			return next;
		},
	};
	return geocoder;
}

const FOUND: AddressCandidate[] = [{ label: 'L', score: 1, precision: 'street' }];
const down = () => new GeocoderError('unavailable', 'down');

describe('RS-01 — retry', () => {
	it('retries a failure that may not happen again, then answers', async () => {
		// Arrange
		const scheduler = simulatedScheduler();
		const inner = scripted([down(), down(), FOUND]);

		// Act
		const result = await withRetry(inner, { ...RETRY_DEFAULTS, maxRetries: 3 }, scheduler).search('q', 5);

		// Assert — 0.5 s then 1 s, times the jitter factor
		expect(result).toBe(FOUND);
		expect(inner.calls).toHaveLength(3);
		expect(scheduler.sleeps).toEqual([375, 750]);
	});

	it('gives up after maxRetries and throws the last failure', async () => {
		// Arrange
		const scheduler = simulatedScheduler();
		const inner = scripted([down()]);

		// Act & Assert
		await expect(withRetry(inner, { ...RETRY_DEFAULTS, maxRetries: 2 }, scheduler).search('q', 5)).rejects.toMatchObject({
			failure: 'unavailable',
		});
		expect(inner.calls).toHaveLength(3);
	});

	it('never retries a rejected request, nor an unexpected error', async () => {
		// Arrange
		const rejected = scripted([new GeocoderError('rejected', 'no')]);
		const broken = scripted([new TypeError('bug')]);

		// Act & Assert
		await expect(withRetry(rejected, { ...RETRY_DEFAULTS, maxRetries: 3 }, simulatedScheduler()).search('q', 5)).rejects.toThrow('no');
		await expect(withRetry(broken, { ...RETRY_DEFAULTS, maxRetries: 3 }, simulatedScheduler()).search('q', 5)).rejects.toThrow('bug');
		expect(rejected.calls).toHaveLength(1);
		expect(broken.calls).toHaveLength(1);
	});

	it('waits at least what the service asks for', async () => {
		// Arrange
		const scheduler = simulatedScheduler();
		const inner = scripted([new GeocoderError('rate_limited', 'slow down', 4000), FOUND]);

		// Act
		await withRetry(inner, { ...RETRY_DEFAULTS, maxRetries: 1 }, scheduler).search('q', 5);

		// Assert
		expect(scheduler.sleeps).toEqual([4000]);
	});

	it('does not wait when the service asks for more than 30 s', async () => {
		// Arrange
		const scheduler = simulatedScheduler();
		const inner = scripted([new GeocoderError('rate_limited', 'come back later', 60_000), FOUND]);

		// Act & Assert — the node's own retry settings take over
		await expect(withRetry(inner, { ...RETRY_DEFAULTS, maxRetries: 3 }, scheduler).search('q', 5)).rejects.toMatchObject({
			failure: 'rate_limited',
		});
		expect(scheduler.sleeps).toEqual([]);
	});

	it('caps the backoff', async () => {
		// Arrange
		const scheduler = simulatedScheduler();
		const inner = scripted([down()]);

		// Act
		await withRetry(inner, { ...RETRY_DEFAULTS, maxRetries: 6 }, scheduler).search('q', 5).catch(() => undefined);

		// Assert — 0.5, 1, 2, 4, 8, 8 s, times 0.75
		expect(scheduler.sleeps).toEqual([375, 750, 1500, 3000, 6000, 6000]);
	});
});

describe('RS-02 — rate limit', () => {
	it('spaces request starts evenly, concurrent callers queued', async () => {
		// Arrange
		const scheduler = simulatedScheduler();
		const limited = withRateLimit(scripted([FOUND]), 40, scheduler);

		// Act — three requests at the same instant, 40 per second = one every 25 ms
		const waits: number[] = [];
		const realSleep = scheduler.sleep;
		scheduler.sleep = async (ms) => {
			waits.push(ms);
		};
		await Promise.all([limited.search('a', 5), limited.search('b', 5), limited.search('c', 5)]);
		scheduler.sleep = realSleep;

		// Assert
		expect(waits).toEqual([25, 50]);
	});

	it('is disabled at 0', () => {
		// Arrange
		const inner = scripted([FOUND]);

		// Assert
		expect(withRateLimit(inner, 0, simulatedScheduler())).toBe(inner);
	});
});

describe('RS-03 — cache of one execution', () => {
	it('asks once per distinct query, case and spacing ignored', async () => {
		// Arrange
		const inner = scripted([FOUND]);
		const cached = withCache(inner);

		// Act
		await cached.search('12 rue de la Paix 75002 Paris', 5);
		await cached.search('12  RUE DE LA PAIX 75002 PARIS', 5);

		// Assert
		expect(inner.calls).toHaveLength(1);
	});

	it('shares a request still in flight', async () => {
		// Arrange
		const inner = scripted([FOUND]);
		const cached = withCache(inner);

		// Act
		const [a, b] = await Promise.all([cached.search('x', 5), cached.search('x', 5)]);

		// Assert
		expect(inner.calls).toHaveLength(1);
		expect(a).toBe(b);
	});

	it('never caches a failure', async () => {
		// Arrange
		const inner = scripted([down(), FOUND]);
		const cached = withCache(inner);

		// Act
		await expect(cached.search('x', 5)).rejects.toThrow('down');
		const second = await cached.search('x', 5);

		// Assert
		expect(second).toBe(FOUND);
		expect(inner.calls).toHaveLength(2);
	});

	it('forgets the least recently used answer beyond its size', async () => {
		// Arrange
		const inner = scripted([FOUND]);
		const cached = withCache(inner, 2);

		// Act
		await cached.search('a', 5);
		await cached.search('b', 5);
		await cached.search('a', 5); // a is now the most recent
		await cached.search('c', 5); // evicts b
		await cached.search('a', 5);
		await cached.search('b', 5);

		// Assert
		expect(inner.calls).toEqual(['a', 'b', 'c', 'b']);
		expect(CACHE_MAX_ENTRIES).toBe(1000);
	});
});

describe('RS-04 — one stack per configuration', () => {
	it('shares the stack of a configuration, separates another', () => {
		// Arrange
		const provider = createGeocoderProvider({ get: async () => ({ status: 200, headers: {}, body: {} }) }, simulatedScheduler());
		const settings = { baseUrl: 'https://a.test', timeoutMs: 1000, maxRetries: 1, requestsPerSecond: 10 };

		// Assert
		expect(provider(settings)).toBe(provider({ ...settings }));
		expect(provider(settings)).not.toBe(provider({ ...settings, baseUrl: 'https://b.test' }));
	});
});

describe('RS-05 — the item pool', () => {
	it('returns results in input order, whatever the order of completion', async () => {
		// Arrange
		const delays = [30, 5, 20, 1, 10];

		// Act
		const results = await mapWithConcurrency(delays, 3, async (delay, index) => {
			await new Promise((resolve) => setTimeout(resolve, delay));
			return index;
		});

		// Assert
		expect(results).toEqual([0, 1, 2, 3, 4]);
	});

	it('never keeps more tasks in flight than allowed', async () => {
		// Arrange
		let inFlight = 0;
		let peak = 0;

		// Act
		await mapWithConcurrency([...Array(20).keys()], 4, async () => {
			inFlight++;
			peak = Math.max(peak, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 2));
			inFlight--;
		});

		// Assert
		expect(peak).toBe(4);
	});

	it('handles an empty list', async () => {
		// Assert
		expect(await mapWithConcurrency([], 8, async () => 1)).toEqual([]);
	});
});
