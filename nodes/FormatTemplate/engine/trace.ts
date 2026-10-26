/**
 * The `_format` trace and the `metadata.messageHistory` entry
 *
 * @version 1.0.0
 * @module FormatTemplate/engine/trace
 *
 * @description
 * `_format` says what was rewritten and with which verdict, without carrying
 * the data (ADR-0006). `metadata.messageHistory` receives one entry per node,
 * following the convention of Enterprise Integration Pattern pipelines, where
 * each step appends to that history and correlation travels in `metadata`.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import type { FtDiagnostic } from '../kernel/diagnostics';

/** Status of a row in the `_format` trace. */
export type FieldStatus = 'ok' | 'unchanged' | 'skipped' | 'failed';

/** Overall status of an item. */
export type ItemStatus = 'ok' | 'partial' | 'failed';

/** One row of `_format.fields[]`. */
export interface FormatFieldTrace {
	path: string;
	type: string;
	/** Path the result was written to, when it is not `path` (`outputPath`). */
	target?: string;
	status: FieldStatus;
	code?: string;
	message?: string;
	before?: string;
	after?: string;
}

/** What identifies the execution in `metadata.messageHistory`. */
export interface TraceContext {
	/** Name of the node in the workflow. */
	nodeName: string;
	/** n8n execution identifier. */
	executionId: string | undefined;
	/** Clock — injected so that the engine stays pure and testable. */
	now: () => Date;
}

/** Maximum length of a value traced under `options.traceValues`. */
const TRACE_VALUE_MAX_LENGTH = 64;

/**
 * Truncates a value for the trace.
 *
 * @param value - Value to describe
 * @returns Text representation, truncated to 64 characters
 */
export function traceValue(value: unknown): string {
	const text = value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
	const safe = text ?? '';
	return safe.length > TRACE_VALUE_MAX_LENGTH ? `${safe.slice(0, TRACE_VALUE_MAX_LENGTH)}…` : safe;
}

/**
 * Recalls the secondary codes of a row in a message.
 *
 * @param message - Message of the main diagnostic
 * @param others - Other non-informational diagnostics of the row
 * @returns Completed message, e.g. `… (FT_PHONE_NUMERIC_INPUT)`
 *
 * @remarks
 * Measured on a real n8n 2.37.11 instance (2026-09-16): `_format` carries only
 * one code per row, and `FT_PHONE_NUMERIC_INPUT` — the actual cause of a lost
 * leading zero — disappeared behind `FT_PHONE_LENGTH_MISMATCH`.
 */
export function withSecondaryCodes(message: string, others: FtDiagnostic[]): string {
	const codes = [...new Set(others.filter((d) => d.severity !== 'info').map((d) => d.code))];
	return codes.length > 0 ? `${message} (${codes.join(', ')})` : message;
}

/**
 * Computes the overall status of an item from its rows.
 *
 * @param entries - Trace rows of the item
 * @returns `ok`, `partial` or `failed`
 */
export function itemStatus(entries: FormatFieldTrace[]): ItemStatus {
	if (entries.length === 0) return 'ok';
	const failures = entries.filter((entry) => entry.status === 'failed').length;
	if (failures === entries.length) return 'failed';
	const gaps = entries.some((entry) => entry.status === 'skipped');
	return failures > 0 || gaps ? 'partial' : 'ok';
}

/**
 * Writes `_format` and appends an entry to `metadata.messageHistory`.
 *
 * @param json - The item's `json`, already cloned, mutated in place
 * @param entries - Trace rows of the item
 * @param context - Identity of the execution
 */
export function writeTrace(
	json: Record<string, unknown>,
	entries: FormatFieldTrace[],
	context: TraceContext,
): void {
	const status = itemStatus(entries);
	json._format = { status, fields: entries };

	const existingMetadata = (json.metadata ?? {}) as Record<string, unknown>;
	const messageHistory = [
		...((existingMetadata.messageHistory as unknown[]) ?? []),
		{
			nodeName: context.nodeName,
			nodeType: 'FormatTemplate',
			timestamp: context.now().toISOString(),
			executionId: context.executionId,
			status: status === 'ok' ? 'completed' : 'error',
			...(status === 'ok'
				? {}
				: {
						validationErrors: entries
							.filter((entry) => entry.status !== 'ok' && entry.status !== 'unchanged')
							.map((entry) => ({ path: entry.path, message: entry.message ?? '' })),
					}),
		},
	];
	json.metadata = { ...existingMetadata, messageHistory };
}
