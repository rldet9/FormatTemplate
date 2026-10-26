/**
 * typeVersion 6 policies — types and interface parameters
 *
 * @version 1.0.0
 * @module FormatTemplate/engine/policies
 *
 * @description
 * The three node-level settings that tell the engine what to do with a field
 * that cannot be transformed, with a missing path, and with the trace
 * (ADR-0003: silence is a policy, not a default). They apply to every
 * transformation, hence their place here rather than in a module.
 *
 * Pure module — `n8n-workflow` is imported as a type only.
 */

import type { INodeProperties } from 'n8n-workflow';

/** Policy applied to a value the transformation refuses. */
export type OnFieldError = 'throw' | 'tag' | 'keep';

/** Policy applied to a path that is valid but missing from the item. */
export type OnMissingField = 'tag' | 'skip' | 'error';

/**
 * Policy applied to a technical failure of a service (ADR-0015), set per row.
 * Its values mean what they mean for `onFieldError`:
 *
 * - `throw` (default): the item fails. Under On Error "Stop Workflow", the node
 *   fails and n8n's Retry On Fail can replay it; under "Continue", the item goes
 *   out as an error item — never an unverified value on the success branch;
 * - `tag`: the value stays, the failure is written to `_format`, and the item
 *   goes out normally.
 *
 * There is no silent choice: a service failure is always said.
 */
export type OnServiceError = 'throw' | 'tag';

/** Policies resolved for one item. */
export interface ItemPolicies {
	onFieldError: OnFieldError;
	onMissingField: OnMissingField;
	/** Writes `_format` and a `metadata.messageHistory` entry. */
	enrichMetadata: boolean;
	/** Adds the before/after values to `_format` — personal data (ADR-0006). */
	traceValues: boolean;
}

/** Node-level parameters of typeVersion 6. */
export const POLICY_PROPERTIES: readonly INodeProperties[] = [
	{
		displayName: 'On Field Error',
		name: 'onFieldError',
		type: 'options',
		default: 'tag',
		displayOptions: { show: { '@version': [6] } },
		description:
			'What to do when a transformation cannot be applied. Never applies to a configuration error — invalid path, unknown type, invalid mask — which always fails the node.',
		options: [
			{
				name: 'Tag the Item',
				value: 'tag',
				description:
					'The value is kept, the diagnostic is written to _format, and the item goes out normally',
			},
			{
				name: 'Fail the Item',
				value: 'throw',
				description:
					'The item fails; with On Error set to continue using the error output, it goes to that output and the other items are still processed',
			},
			{
				name: 'Keep Silently',
				value: 'keep',
				description: 'The value is kept and no diagnostic is written — a deliberate silence',
			},
		],
	},
	{
		displayName: 'On Missing Field',
		name: 'onMissingField',
		type: 'options',
		default: 'tag',
		displayOptions: { show: { '@version': [6] } },
		description:
			'What to do when the path is valid but absent from the item. In typeVersion 5 it was skipped silently, without a trace.',
		options: [
			{ name: 'Tag the Item', value: 'tag' },
			{ name: 'Skip Without Trace', value: 'skip' },
			{ name: 'Fail the Item', value: 'error' },
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { '@version': [6] } },
		options: [
			{
				displayName: 'Enrich Metadata',
				name: 'enrichMetadata',
				type: 'boolean',
				default: true,
				description:
					'Whether to write the _format trace and a metadata.messageHistory entry on each item',
			},
			{
				displayName: 'Trace Values',
				name: 'traceValues',
				type: 'boolean',
				default: false,
				description:
					'Whether to add the before/after values to _format, truncated to 64 characters. These values are personal data — names, phone numbers — hence off by default.',
			},
		],
	},
];
