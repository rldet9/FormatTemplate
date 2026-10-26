/**
 * Time and chance, injectable
 *
 * @version 1.0.0
 * @module FormatTemplate/adapters/resilience/scheduler
 *
 * @description
 * The resilience decorators wait and draw jitter. They receive these two
 * capabilities instead of waiting and drawing directly, so that their tests
 * run on a simulated clock, instantly and deterministically.
 *
 * The real scheduler waits with n8n's own `sleep`: a community node must not
 * call `setTimeout` itself (n8n's `no-restricted-globals` rule).
 */

import { sleep } from 'n8n-workflow';

/** What the resilience decorators need from the runtime. */
export interface Scheduler {
	/** Current time, in milliseconds. */
	now(): number;
	/** Resolves after the given delay. */
	sleep(ms: number): Promise<void>;
	/** A number in [0, 1). */
	random(): number;
}

/** The real scheduler. */
export const SYSTEM_SCHEDULER: Scheduler = {
	now: () => Date.now(),
	sleep: (ms) => sleep(ms),
	random: () => Math.random(),
};
