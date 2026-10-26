/**
 * `FormatOutcome` — the typed result of a transform
 *
 * @version 1.0.0
 * @module FormatTemplate/kernel/outcome
 *
 * @description
 * ADR-0007: "a transform is pure". It receives a value and parameters, it
 * returns a typed result, it does not throw and it does not know
 * `IExecuteFunctions`. This is what lets the engine decide **per item**
 * (ADR-0001) instead of suffering a `throw` that crosses the whole batch.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import type { FtDiagnostic } from './diagnostics';

/** Status of a field transformation. */
export type FormatStatus = 'ok' | 'unchanged' | 'failed';

/**
 * Result of a transformation.
 *
 * @remarks
 * - `ok`: the value was transformed, `value` carries the new value.
 * - `unchanged`: nothing to do (empty value, already normalized). The
 *   original value is kept as is; this is **not** a failure.
 * - `failed`: the transformation cannot apply. ADR-0002: a transform
 *   **never** produces an approximate value; `value` is absent and the
 *   caller keeps the original.
 */
export interface FormatOutcome {
	/** Status of the transformation. */
	status: FormatStatus;
	/** New value — present for `ok` only. */
	value?: unknown;
	/** Diagnostics raised, including on a success (warnings). */
	diagnostics: FtDiagnostic[];
}

/**
 * Builds an `ok` result.
 *
 * @param value - Transformed value
 * @param diagnostics - Optional warnings (`FT_PHONE_NUMERIC_INPUT`…)
 * @returns `ok` result
 *
 * @example
 * ```ts
 * outcomeOk('03 20 00 00 00');
 * ```
 */
export function outcomeOk(value: unknown, diagnostics: FtDiagnostic[] = []): FormatOutcome {
	return { status: 'ok', value, diagnostics };
}

/**
 * Builds an `unchanged` result.
 *
 * @param diagnostics - Explanatory diagnostics (`FT_VALUE_EMPTY`…)
 * @returns `unchanged` result
 *
 * @example
 * ```ts
 * outcomeUnchanged([ftDiagnostic(FT_CODES.VALUE_EMPTY, 'Empty value')]);
 * ```
 */
export function outcomeUnchanged(diagnostics: FtDiagnostic[] = []): FormatOutcome {
	return { status: 'unchanged', diagnostics };
}

/**
 * Builds a `failed` result.
 *
 * @param diagnostics - Diagnostics of the failure; at least one
 * @returns `failed` result
 *
 * @example
 * ```ts
 * outcomeFailed([ftDiagnostic(FT_CODES.COUNTRY_UNKNOWN, 'No ISO 3166-1 match.')]);
 * ```
 */
export function outcomeFailed(diagnostics: FtDiagnostic[]): FormatOutcome {
	return { status: 'failed', diagnostics };
}

/**
 * Common signature of the pure transform functions of typeVersion 6.
 *
 * @remarks
 * The value arrives **unconverted**: this is what lets `phone` tell a numeric
 * input (leading zero lost at import time) from a string. typeVersion 5
 * called its handlers with `String(value)` and lost that information.
 */
export type PureHandler = (value: unknown, params: Record<string, unknown>) => FormatOutcome;
