/**
 * Processing items concurrently, results in input order
 *
 * @version 1.0.0
 * @module FormatTemplate/engine/pool
 *
 * @description
 * A transformation backed by a web service waits on the network. Processing
 * items one after the other would add up those waits; processing them all at
 * once would flood the service. The pool keeps a fixed number of items in
 * flight — the rate limit of the geocoding adapter still applies on top — and
 * returns the results **in the order of the inputs**, whatever the order in
 * which they complete.
 *
 * Pure module — no import of `n8n-workflow`.
 */

/**
 * Maps a list with a bounded number of tasks in flight.
 *
 * @param items - Inputs
 * @param concurrency - Maximum number of tasks in flight (at least 1)
 * @param task - Asynchronous task; should not throw (a throw rejects the whole map)
 * @returns Results, in input order
 *
 * @example
 * ```ts
 * await mapWithConcurrency([3, 1, 2], 2, async (n) => n * 2); // [6, 2, 4]
 * ```
 */
export async function mapWithConcurrency<T, R>(
	items: readonly T[],
	concurrency: number,
	task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	const worker = async (): Promise<void> => {
		while (next < items.length) {
			const index = next++;
			results[index] = await task(items[index], index);
		}
	};
	const workers = Math.max(1, Math.min(concurrency, items.length));
	await Promise.all(Array.from({ length: workers }, worker));
	return results;
}
