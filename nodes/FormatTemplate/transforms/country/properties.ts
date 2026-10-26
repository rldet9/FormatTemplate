/**
 * Interface parameters of a `country` row
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/country/properties
 *
 * @description
 * Declared without the condition on `type`, which `scopeToTransform` adds.
 * Both only exist in typeVersion 6: typeVersion 5 had no policy at all.
 */

import type { INodeProperties } from 'n8n-workflow';

/** Parameters of a `country` row, in display order. */
export const COUNTRY_PROPERTIES: readonly INodeProperties[] = [
	{
		displayName: 'On Unknown Country',
		name: 'onUnknown',
		type: 'options',
		default: 'error',
		displayOptions: { show: { '@version': [6] } },
		description:
			'What to do with a value the embedded ISO 3166-1 table cannot resolve. In typeVersion 5 the whole node failed.',
		options: [
			{ name: 'Fail the Item', value: 'error' },
			{ name: 'Keep the Value', value: 'keep' },
			{ name: 'Empty the Field', value: 'empty' },
		],
	},
	{
		displayName: 'Accept Unknown Two-Letter Codes',
		name: 'acceptUnknownAlpha2',
		type: 'boolean',
		default: false,
		displayOptions: { show: { '@version': [6] } },
		description:
			'Whether to let a two-letter code absent from ISO 3166-1 through, in uppercase. This was the silent behavior of typeVersion 5, made explicit: it is what let a "ZZ" travel down the chain.',
	},
];
