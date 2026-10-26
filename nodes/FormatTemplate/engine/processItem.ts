/**
 * Processing one item — the core of typeVersion 6
 *
 * @version 1.0.0
 * @module FormatTemplate/engine/processItem
 *
 * @description
 * Every decision of typeVersion 6 is taken here; the n8n adapter only reads
 * the parameters and turns the result into n8n output.
 *
 * What the loop guarantees:
 *
 * - the decision is taken **per item** (ADR-0001); only a **configuration**
 *   diagnostic is returned as such, and the adapter then fails the node;
 * - an invalid path and a missing path are two distinct cases, each with its
 *   policy (ADR-0003); a `fieldPath` coming from an expression is reported;
 * - the `_format` trace and `metadata.messageHistory` (see `trace.ts`);
 * - an exception thrown by a module becomes `FT_INTERNAL_ERROR`, which follows
 *   the same policy as any other failure (ADR-0007);
 * - a **technical** failure of a service follows the row's `onServiceError`,
 *   never `onFieldError`: it is not a verdict on the data (ADR-0015);
 * - the result is written to the field itself, or to the row's `outputPath`.
 *
 * The engine does not throw to say that an item fails: it returns an
 * {@link ItemResult}. An exception that crosses it (an uncloneable item, for
 * instance) is an unexpected defect, which the adapter attaches to the item.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import {
	FT_CODES,
	ftDiagnostic,
	isConfigurationDiagnostic,
	isTechnicalDiagnostic,
	type FtDiagnostic,
} from '../kernel/diagnostics';
import {
	looksLikeExpressionPath,
	parseFieldPath,
	readAtPath,
	writeAtPath,
} from '../kernel/fieldPath';
import type { FormatOutcome } from '../kernel/outcome';
import type { TransformModule } from '../kernel/transformModule';
import type { ItemPolicies, OnServiceError } from './policies';
import {
	traceValue,
	withSecondaryCodes,
	writeTrace,
	type FormatFieldTrace,
	type TraceContext,
} from './trace';

/** Result of processing one item. */
export type ItemResult =
	| {
			ok: true;
			/** Output `json` — a clone, never the input object. */
			json: Record<string, unknown>;
	  }
	| {
			ok: false;
			/** Diagnostic that sends the item to error, or fails the node if it is a configuration one. */
			diagnostic: FtDiagnostic;
			/** Trace rows written before the failure, faulty row included. */
			entries: FormatFieldTrace[];
	  };

/** Inputs for processing one item. */
export interface ItemInput {
	/** The input item's `json`; it is cloned, never mutated. */
	json: unknown;
	/** Configuration rows resolved for this item (`getNodeParameter`). */
	rows: ReadonlyArray<Record<string, unknown>>;
	/** Raw rows, as saved — to recognize an expression. */
	rawRows: ReadonlyArray<Record<string, unknown>>;
	/** Policies resolved for this item. */
	policies: ItemPolicies;
	/** Index of the item, carried onto the diagnostics. */
	itemIndex: number;
}

/**
 * Processes one item: applies each row, then writes the trace.
 *
 * @param input - Item, rows and policies
 * @param transforms - Registered modules
 * @param traceContext - Identity of the execution, for `metadata.messageHistory`
 * @param transformContext - Services of the execution, handed to the modules
 *                           untouched — the engine does not know them
 * @returns Transformed item, or failure diagnostic with the partial trace
 *
 * @example
 * ```ts
 * const result = await processItem(
 *   { json: { country: 'France' }, rows: [{ fieldPath: 'country', type: 'country' }],
 *     rawRows: [...], policies, itemIndex: 0 },
 *   TRANSFORM_MODULES,
 *   { nodeName: 'Format', executionId: '1', now: () => new Date() },
 *   { geocoder: () => fakeGeocoder },
 * );
 * // { ok: true, json: { country: 'FR', _format: { status: 'ok', … }, metadata: … } }
 * ```
 */
export async function processItem<Context>(
	input: ItemInput,
	transforms: readonly TransformModule<Context>[],
	traceContext: TraceContext,
	transformContext: Context,
): Promise<ItemResult> {
	const { rows, rawRows, policies, itemIndex } = input;
	const { onFieldError, onMissingField, traceValues } = policies;
	const entries: FormatFieldTrace[] = [];
	const fail = (diagnostic: FtDiagnostic): ItemResult => ({ ok: false, diagnostic, entries });

	const json = JSON.parse(JSON.stringify(input.json)) as Record<string, unknown>;

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
		const field = rows[rowIndex];
		const fieldPath = (field.fieldPath ?? '') as string;
		const type = (field.type ?? '') as string;
		if (fieldPath === '') continue;

		const rowDiagnostics: FtDiagnostic[] = [];

		// --- Provenance of the path ---------------------------------------------
		const rawPath = rawRows[rowIndex]?.fieldPath;
		const fromExpression = looksLikeExpressionPath(rawPath, fieldPath);

		// --- Shape of the path: a configuration matter ----------------------------
		const parsed = parseFieldPath(fieldPath);
		if (!parsed.ok) {
			return fail(
				ftDiagnostic(
					parsed.reason === 'reserved' ? FT_CODES.PATH_RESERVED : FT_CODES.PATH_INVALID,
					fromExpression
						? `${parsed.message} This path comes from an n8n expression: it returned a value, not a path.`
						: parsed.message,
					{ itemIndex, parameter: `fieldsToFormat.field[${rowIndex}].fieldPath` },
				),
			);
		}

		// --- Where to write: the field itself, or the row's `outputPath` ---------------
		const outputPath = typeof field.outputPath === 'string' ? field.outputPath.trim() : '';
		const target = outputPath === '' ? parsed : parseFieldPath(outputPath);
		if (!target.ok) {
			return fail(
				ftDiagnostic(
					target.reason === 'reserved' ? FT_CODES.PATH_RESERVED : FT_CODES.PATH_INVALID,
					target.message,
					{ itemIndex, parameter: `fieldsToFormat.field[${rowIndex}].outputPath` },
				),
			);
		}

		const transform = transforms.find((module) => module.type === type);
		if (!transform) {
			return fail(
				ftDiagnostic(FT_CODES.TYPE_UNKNOWN, `Unknown transformation type: "${type}".`, {
					itemIndex,
					parameter: `fieldsToFormat.field[${rowIndex}].type`,
				}),
			);
		}

		if (fromExpression) {
			rowDiagnostics.push(
				ftDiagnostic(
					FT_CODES.PATH_FROM_EXPRESSION,
					'The path comes from an n8n expression: check that it returns the name of a property, ' +
						'not its value.',
					{ path: fieldPath, severity: 'warning' },
				),
			);
		}

		// --- Presence of the path: a data matter ---------------------------------
		const lookup = readAtPath(json, parsed.tokens);
		if (!lookup.found) {
			const missing = ftDiagnostic(
				FT_CODES.PATH_NOT_FOUND,
				'Path not found in the item: nothing was normalized.',
				{ path: fieldPath, itemIndex, severity: onMissingField === 'error' ? 'error' : 'warning' },
			);
			// The provenance warning matters **most** when the path is then missing:
			// that is the costly case. The code stays the one of the absence; the
			// provenance is recalled in the message.
			const missingEntry: FormatFieldTrace = {
				path: fieldPath,
				type,
				status: onMissingField === 'error' ? 'failed' : 'skipped',
				code: missing.code,
				message: withSecondaryCodes(missing.message, rowDiagnostics),
			};
			if (onMissingField === 'error') {
				entries.push(missingEntry);
				return fail(missing);
			}
			if (onMissingField === 'tag') entries.push(missingEntry);
			continue;
		}

		// --- Transformation -------------------------------------------------------
		let outcome: FormatOutcome;
		try {
			outcome = await transform.run(lookup.value, field, transformContext);
		} catch (error) {
			// ADR-0007: no silent fallback — the exception becomes a typed diagnostic.
			outcome = {
				status: 'failed',
				diagnostics: [
					ftDiagnostic(
						FT_CODES.INTERNAL_ERROR,
						`Internal error in the "${type}" handler: ${(error as Error).message}`,
						{ path: fieldPath, itemIndex },
					),
				],
			};
		}

		const diagnostics = [...rowDiagnostics, ...outcome.diagnostics];
		const first = diagnostics.find((d) => d.severity !== 'info') ?? diagnostics[0];

		if (outcome.status === 'failed') {
			const failure = outcome.diagnostics[outcome.diagnostics.length - 1] ?? first;
			if (isConfigurationDiagnostic(failure)) {
				return fail({ ...failure, itemIndex, path: fieldPath });
			}
			const failedEntry: FormatFieldTrace = {
				path: fieldPath,
				type,
				status: 'failed',
				code: failure.code,
				message: withSecondaryCodes(
					failure.message,
					diagnostics.filter((d) => d !== failure),
				),
				...(traceValues ? { before: traceValue(lookup.value) } : {}),
			};
			if (isTechnicalDiagnostic(failure)) {
				// ADR-0015: a service failure is not a verdict on the data — its own policy.
				// `throw` fails the item; the adapter fails the node unless n8n is set to
				// continue (ADR-0015, decision 3). Any value but `tag` throws: the safe side.
				const onServiceError = (field.onServiceError ?? 'throw') as OnServiceError;
				entries.push(failedEntry);
				if (onServiceError === 'tag') continue;
				return fail({ ...failure, itemIndex, path: fieldPath });
			}
			if (onFieldError === 'throw') {
				// The faulty row is traced before the item fails: the item on the error
				// output tells which field sent it there.
				entries.push(failedEntry);
				return fail({ ...failure, itemIndex, path: fieldPath });
			}
			if (onFieldError === 'tag') {
				entries.push(failedEntry);
			}
			// `keep`: the value stays, no diagnostic — a deliberate silence.
			continue;
		}

		const changed = outcome.status === 'ok';
		if (changed) {
			writeAtPath(json, target.tokens, outcome.value);
		}

		entries.push({
			path: fieldPath,
			type,
			...(outputPath !== '' ? { target: outputPath } : {}),
			status: changed ? 'ok' : 'unchanged',
			...(first ? { code: first.code, message: first.message } : {}),
			...(traceValues
				? {
						before: traceValue(lookup.value),
						after: traceValue(changed ? outcome.value : lookup.value),
					}
				: {}),
		});
	}

	if (policies.enrichMetadata) {
		writeTrace(json, entries, traceContext);
	}

	return { ok: true, json };
}
