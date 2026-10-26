/**
 * Format Template — field normalization (phone, text case, country code)
 *
 * @version 6.1.0
 * @module nodes/FormatTemplate
 *
 * @description
 * Rewrites in place the value of fields designated by their path, according
 * to one transformation type per row.
 *
 * The node carries **two typeVersions**:
 *
 * - **5**, historical, served by `v5/executeLegacy.ts` and frozen by
 *   characterization tests. A workflow saved in 5 is **never** migrated on
 *   load (ADR-0004);
 * - **6**, served by `executeV6.ts`: per-item decision, explicit policies,
 *   `_format` trace, `pairedItem`.
 *
 * Routing is done on `this.getNode().typeVersion`.
 *
 * This file only **assembles** the description (ADR-0010): `fieldPath` and
 * `type`, then the parameters of each transformation
 * (`transforms/<type>/properties.ts`), then the node-level policies
 * (`engine/policies.ts`).
 *
 * @changelog
 * - 6.1: layered into `kernel/`, `engine/`, `transforms/` and `v5/`;
 *   interface and `FT_*` messages in English (ADR-0010, ADR-0012). Same
 *   behaviour, same parameters.
 * - 6: a faulty item no longer fails the batch, the mask no longer makes up
 *   numbers, `country` exposes a single policy, a missing field and an invalid
 *   path are told apart.
 * - 5: the execution loop moved out of the class; the former "auto-discovery"
 *   registry, which promised a dynamic discovery the code never did, was
 *   removed. No behaviour change.
 */

import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { POLICY_PROPERTIES } from './engine/policies';
import { executeV6 } from './executeV6';
import { TRANSFORM_MODULES, transformRowProperties } from './transforms';
import { executeLegacy } from './v5/executeLegacy';

/** Rows of `fieldsToFormat.field` — the path, the type, then the parameters of each type. */
const fieldProperties: INodeProperties[] = [
	{
		displayName: 'Field Path',
		name: 'fieldPath',
		type: 'string',
		default: '',
		description:
			'Name of the property to format, in dot notation (e.g. "phone", "client.phone") — never its value',
		placeholder: 'e.g. phone',
		// A field dragged from the input panel is written as its path (`client.phone`), not as
		// `{{ $json.client.phone }}`, which would resolve to the value
		requiresDataPath: 'single',
		typeOptions: {
			expressionResultMemoize: true,
			listPropertyValues: 'keys',
			multipleValues: false,
		},
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		default: '',
		options: TRANSFORM_MODULES.map((module) => ({
			name: module.displayName,
			value: module.type,
			description: module.description,
		})),
	},
	...transformRowProperties(),
];

/**
 * The `formatTemplate` node.
 */
export class FormatTemplate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Format Template',
		name: 'formatTemplate',
		icon: { light: 'file:FormatTemplate.svg', dark: 'file:FormatTemplate.dark.svg' },
		group: ['transform'],
		version: [5, 6],
		defaultVersion: 6,
		description: 'Overwrite properties with formatted values',
		usableAsTool: true,
		defaults: {
			name: 'Format Template',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Fields to Format',
				name: 'fieldsToFormat',
				placeholder: 'Add Field',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'field',
						displayName: 'Field',
						values: fieldProperties,
					},
				],
			},
			...POLICY_PROPERTIES,
		],
	};

	/**
	 * n8n entry point.
	 *
	 * @returns Output items, per output
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// A saved workflow is never migrated on load (ADR-0004): the stored
		// typeVersion chooses the implementation, not the other way round.
		const typeVersion = this.getNode().typeVersion ?? 5;
		return typeVersion >= 6 ? executeV6.call(this) : executeLegacy.call(this);
	}
}
