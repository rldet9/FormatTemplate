/**
 * Interface parameters of a `postalAddress` row
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/postalAddress/properties
 *
 * @description
 * Declared without the condition on `type`, which `scopeToTransform` adds.
 * typeVersion 6 only. The calibrated thresholds and the service settings sit
 * in an "Advanced" collection: their defaults are the measured ones
 * (`params.ts`), and most workflows never need to touch them.
 *
 * The defaults are written as literals: n8n's linter reads them from the
 * source (`node-param-default-missing`). PA-N06 proves they equal the
 * defaults applied at runtime, `ADDRESS_DEFAULTS`.
 */

import type { INodeProperties } from 'n8n-workflow';

const V6 = { show: { '@version': [6] } };

/** Parameters of a `postalAddress` row, in display order. */
export const POSTAL_ADDRESS_PROPERTIES: readonly INodeProperties[] = [
	{
		displayName: 'Output Format',
		name: 'outputFormat',
		type: 'options',
		default: 'postalLines',
		displayOptions: V6,
		description:
			'Shape of the value written back. The address is written only when the national address base confirms it (verified, or corrected if accepted); otherwise the original value stays, with a diagnostic.',
		options: [
			{
				name: 'Postal Lines (NF Z10-011)',
				value: 'postalLines',
				description:
					'Array of lines to the French standard: 38 characters at most, uppercase without punctuation from line 4',
			},
			{
				name: 'Label',
				value: 'label',
				description: 'One line, as written by the national address base: "8 Boulevard du Port 80000 Amiens"',
			},
			{
				name: 'Structured Object',
				value: 'structured',
				description:
					'Verdict, corrections, precision, score, postal lines, street, postcode, municipality, INSEE code, national identifier and coordinates',
			},
		],
	},
	{
		displayName: 'Output Path',
		name: 'outputPath',
		type: 'string',
		default: '',
		displayOptions: V6,
		placeholder: 'e.g. addressChecked',
		description:
			'Path of the field to write the result to, in dot notation. Leave empty to replace the input field; set it to keep the original address.',
	},
	{
		displayName: 'Minimum Precision',
		name: 'minimumPrecision',
		type: 'options',
		default: 'housenumber',
		displayOptions: V6,
		description:
			'Precision required when the input gives a house number. An input without a number is always checked at street level.',
		options: [
			{
				name: 'House Number',
				value: 'housenumber',
				description: 'The house number must exist in the national address base',
			},
			{
				name: 'Street',
				value: 'street',
				description: 'The street must exist; an unknown house number is accepted',
			},
		],
	},
	{
		displayName: 'Accept Corrections',
		name: 'acceptCorrections',
		type: 'boolean',
		default: true,
		displayOptions: V6,
		description:
			'Whether to write an address the national base had to correct (postcode, municipality, street spelling). The corrected fields are named in _format, never their values.',
	},
	{
		displayName: 'On Service Error',
		name: 'onServiceError',
		type: 'options',
		default: 'throw',
		displayOptions: V6,
		description:
			'What to do when the geocoding service cannot answer — after its retries. A service failure is never read as an invalid address.',
		options: [
			{
				name: 'Fail the Item',
				value: 'throw',
				description:
					'The item fails. With On Error set to stop the workflow, the node fails and its Retry On Fail setting can replay it; set to continue, the item goes out as an error item, never unchecked.',
			},
			{
				name: 'Tag the Item',
				value: 'tag',
				description:
					'The value is kept, the failure is written to _format, and the item goes out normally',
			},
		],
	},
	{
		displayName: 'Add Country Line',
		name: 'includeCountryLine',
		type: 'boolean',
		default: false,
		displayOptions: V6,
		description: 'Whether to add FRANCE as the last line, for mail posted from abroad',
	},
	{
		displayName: 'Remove Accents',
		name: 'stripAccents',
		type: 'boolean',
		default: true,
		displayOptions: V6,
		description:
			'Whether to remove accents from lines 4 to 7. The standard does not require it; postal reference files are written that way.',
	},
	{
		displayName: 'Advanced',
		name: 'advanced',
		type: 'collection',
		placeholder: 'Add Setting',
		default: {},
		displayOptions: V6,
		options: [
			{
				displayName: 'Ambiguity Margin',
				name: 'ambiguityMargin',
				type: 'number',
				default: 0.05,
				typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 3 },
				description:
					'Score gap under which two different places matching the input equally make it ambiguous. Calibrated safe range: 0.005 to 0.5.',
			},
			{
				displayName: 'Maximum Retries',
				name: 'maxRetries',
				type: 'number',
				default: 3,
				typeOptions: { minValue: 0, maxValue: 5 },
				description:
					'Retries after a timeout, a server error or a request to slow down, with an exponential backoff',
			},
			{
				displayName: 'Minimum Score',
				name: 'minScore',
				type: 'number',
				default: 0.5,
				typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
				description:
					'Lowest relevance score accepted — a safety net only: the verdict compares the answer with the input. Calibrated safe range: 0.30 to 0.62.',
			},
			{
				displayName: 'Requests per Second',
				name: 'requestsPerSecond',
				type: 'number',
				default: 40,
				typeOptions: { minValue: 1, maxValue: 50 },
				description: 'Maximum requests started per second. The public service accepts 50 per IP address.',
			},
			{
				displayName: 'Service URL',
				name: 'baseUrl',
				type: 'string',
				default: 'https://data.geopf.fr/geocodage',
				description:
					'Base URL of the geocoding service (HTTPS). The default is the free service of the French State; an instance with the same interface may be used instead.',
			},
			{
				displayName: 'Street Similarity',
				name: 'streetSimilarity',
				type: 'number',
				default: 0.8,
				typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
				description:
					'Similarity under which two street names are different streets. Must stay above 2/3; calibrated default 0.8.',
			},
			{
				displayName: 'Timeout (Ms)',
				name: 'timeoutMs',
				type: 'number',
				default: 10000,
				typeOptions: { minValue: 1000, maxValue: 60000 },
				description: 'Time allowed per request, in milliseconds',
			},
		],
	},
];
