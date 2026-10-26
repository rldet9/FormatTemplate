/**
 * n8n adapter of typeVersion 6
 *
 * @version 6.2.0
 * @module FormatTemplate/executeV6
 *
 * @description
 * This file takes no verdict (ADR-0007, ADR-0010):
 *
 * 1. it looks for configuration errors (`engine/precheck.ts`) and fails the node;
 * 2. it builds the services of the execution — the geocoding stack on n8n's
 *    HTTP helper (ADR-0015) — handed to the transformations;
 * 3. it reads, per item, the resolved rows and policies, and hands the item
 *    over to the engine (`engine/processItem.ts`), a few items at a time;
 * 4. it turns the results, in input order, into n8n output: `pairedItem` on
 *    every item, `continueOnFail()`, and the error-item shape the n8n engine
 *    imposes (ADR-0011).
 *
 * It is the **only** boundary where a diagnostic becomes a `NodeOperationError`.
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	JsonObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { createGeocoderProvider } from './adapters/geocoding';
import { createN8nHttpClient } from './adapters/n8n/httpClient';
import { SYSTEM_SCHEDULER } from './adapters/resilience/scheduler';
import type { ItemPolicies, OnFieldError, OnMissingField } from './engine/policies';
import { mapWithConcurrency } from './engine/pool';
import { precheckRows } from './engine/precheck';
import { processItem } from './engine/processItem';
import type { FormatFieldTrace, TraceContext } from './engine/trace';
import { isConfigurationDiagnostic, type FtDiagnostic } from './kernel/diagnostics';
import type { TransformContext } from './ports/transformContext';
import { TRANSFORM_MODULES } from './transforms';

/**
 * Items processed at the same time.
 *
 * @remarks
 * Only a transformation that waits on a service benefits from it; the
 * geocoding adapter's rate limit still applies on top. Results are written in
 * input order whatever the order of completion.
 */
const ITEM_CONCURRENCY = 8;

/** The processing of one item, before it becomes n8n output. */
type Settled =
	| { ok: true; item: INodeExecutionData }
	| { ok: false; error: unknown; entries: FormatFieldTrace[] };

/**
 * Reads the configuration rows **raw**, as saved.
 *
 * @param context - n8n context
 * @returns Raw rows, or an empty array
 *
 * @remarks
 * This is the only way to see that a `fieldPath` was an expression.
 * `getNodeParameter` returns the **resolved** value, and a
 * `={{ $json.country }}` arrives there as `France` — indistinguishable from a
 * literal path.
 */
function rawFieldRows(context: IExecuteFunctions): IDataObject[] {
	const parameters = (context.getNode().parameters ?? {}) as IDataObject;
	const collection = (parameters.fieldsToFormat ?? {}) as IDataObject;
	const rows = collection.field;
	return Array.isArray(rows) ? (rows as IDataObject[]) : [];
}

/**
 * Reads the policies resolved for one item.
 *
 * @param context - n8n context
 * @param itemIndex - Index of the item
 * @returns Policies of the item
 */
function readPolicies(context: IExecuteFunctions, itemIndex: number): ItemPolicies {
	const onFieldError = context.getNodeParameter('onFieldError', itemIndex, 'tag') as OnFieldError;
	const onMissingField = context.getNodeParameter(
		'onMissingField',
		itemIndex,
		'tag',
	) as OnMissingField;
	const options = context.getNodeParameter('options', itemIndex, {}) as IDataObject;
	return {
		onFieldError,
		onMissingField,
		enrichMetadata: options.enrichMetadata !== false,
		traceValues: options.traceValues === true,
	};
}

/**
 * Turns a diagnostic into a node error — the single boundary.
 *
 * @param context - n8n context
 * @param diagnostic - Diagnostic to relay
 * @returns Error ready to be thrown
 */
function toNodeError(context: IExecuteFunctions, diagnostic: FtDiagnostic): NodeOperationError {
	const error = new NodeOperationError(
		context.getNode(),
		`[${diagnostic.code}] ${diagnostic.message}`,
		{
			itemIndex: diagnostic.itemIndex,
			description: diagnostic.path
				? `Field: ${diagnostic.path}`
				: diagnostic.parameter
					? `Parameter: ${diagnostic.parameter}`
					: undefined,
		},
	);
	error.context.ftCode = diagnostic.code;
	return error;
}

/**
 * Tells whether a node error must fail the whole node, `continueOnFail()` included.
 *
 * @param error - Error of an item
 * @returns `true` for a configuration error only (ADR-0001). A service failure
 *          is attached to its item under `continueOnFail()`: n8n, set to
 *          continue, would pass a failed node's input items through unchecked
 *          (ADR-0015)
 */
function failsTheNode(error: NodeOperationError): boolean {
	const code = error.context?.ftCode;
	return typeof code === 'string' && isConfigurationDiagnostic({ code, message: '' });
}

/**
 * Executes the node in typeVersion 6.
 *
 * @returns The items of the single output; n8n extracts the error output
 *          from it when `onError` is `continueErrorOutput`
 *
 * @example
 * ```ts
 * // From the node class
 * return executeV6.call(this);
 * ```
 */
export async function executeV6(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	const rawRows = rawFieldRows(this);

	// ADR-0001: a faulty setup fails before touching the first item.
	const misconfigured = precheckRows(rawRows, TRANSFORM_MODULES);
	if (misconfigured) throw toNodeError(this, misconfigured);

	const traceContext: TraceContext = {
		nodeName: this.getNode().name,
		executionId: this.getExecutionId(),
		now: () => new Date(),
	};
	// ADR-0015: one geocoding stack per configuration, for this execution only.
	const transformContext: TransformContext = {
		geocoder: createGeocoderProvider(createN8nHttpClient(this), SYSTEM_SCHEDULER),
	};

	const settled = await mapWithConcurrency(
		items,
		ITEM_CONCURRENCY,
		async (item, itemIndex): Promise<Settled> => {
			try {
				const policies = readPolicies(this, itemIndex);
				const rows = this.getNodeParameter('fieldsToFormat.field', itemIndex, []) as IDataObject[];

				const result = await processItem(
					{ json: item.json, rows, rawRows, policies, itemIndex },
					TRANSFORM_MODULES,
					traceContext,
					transformContext,
				);
				if (!result.ok) {
					// The partial trace travels with the item to the error output.
					return {
						ok: false,
						error: toNodeError(this, result.diagnostic),
						entries: result.entries,
					};
				}
				return {
					ok: true,
					item: {
						json: result.json as IDataObject,
						binary: item.binary ? JSON.parse(JSON.stringify(item.binary)) : undefined,
						pairedItem: { item: itemIndex },
					},
				};
			} catch (error) {
				return { ok: false, error, entries: [] };
			}
		},
	);

	for (let itemIndex = 0; itemIndex < settled.length; itemIndex++) {
		const outcome = settled[itemIndex];
		if (outcome.ok) {
			returnData.push(outcome.item);
			continue;
		}
		const nodeError =
			outcome.error instanceof NodeOperationError
				? outcome.error
				: new NodeOperationError(this.getNode(), outcome.error as JsonObject, { itemIndex });

		// ADR-0001: a faulty setup fails the node, `continueOnFail()` included. Faulty
		// data and service failures are attached to their item under `continueOnFail()`:
		// thrown there, n8n would pass the input items through unchecked, on the success
		// output (ADR-0015). Without it, any failure fails the node — Retry On Fail can
		// then replay it.
		if (this.continueOnFail() && !failsTheNode(nodeError)) {
			// ⚠️ Shape imposed by the engine, measured on a real n8n 2.37.11 instance
			// (ADR-0011):
			// - n8n-core only routes an item to the error output if `item.error` is set
			//   or if `json` carries NOTHING BUT error/message/details. A `_format` next
			//   to `error` left the item on the success output;
			// - setting `item.error` makes n8n rewrite `json` to `{ error }` alone, after
			//   routing: the trace and the original data disappeared.
			// Hence `error` + `details`, without `item.error`: n8n then merges the paired
			// INPUT item into the error-output item, which keeps its original fields.
			returnData.push({
				json: {
					error: nodeError.message,
					details: {
						code: nodeError.context?.ftCode,
						_format: { status: 'failed', fields: outcome.entries },
					} as unknown as IDataObject,
				},
				pairedItem: { item: itemIndex },
			});
			continue;
		}
		throw nodeError;
	}

	return [returnData];
}
