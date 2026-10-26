/**
 * Interface parameters of a `phone` row
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/phone/properties
 *
 * @description
 * Declared without the condition on `type`, which `scopeToTransform` adds. The
 * `@version` condition stays here: `pattern` only exists in typeVersion 5, the
 * three others only in typeVersion 6.
 */

import type { INodeProperties } from 'n8n-workflow';

import { PHONE_COUNTRY_OPTIONS } from './numberingPlans';

/** Parameters of a `phone` row, in display order. */
export const PHONE_PROPERTIES: readonly INodeProperties[] = [
	// --- Phone, typeVersion 5 -----------------------------------------------
	{
		displayName: 'Pattern',
		name: 'pattern',
		type: 'options',
		default: '{0:+33 (0) # ## ## ## ##}',
		displayOptions: { show: { '@version': [5] } },
		description:
			'Mask of typeVersion 5. Caution: in this version "0" consumes a digit, and the number of digits is not checked — see the node documentation.',
		typeOptions: {
			allowCustomValues: true,
		},
		options: [
			{
				name: '+33 (0) # ## ## ## ## (FR International, National Input Only)',
				value: '{0:+33 (0) # ## ## ## ##}',
			},
			{
				name: '0# ## ## ## ## (FR National)',
				value: '{0:0# ## ## ## ##}',
			},
			{
				name: '(###) ###-#### (US)',
				value: '{0:(###) ###-####}',
			},
		],
	},

	// --- Phone, typeVersion 6 -----------------------------------------------
	{
		displayName: 'Output Format',
		name: 'phoneOutput',
		type: 'options',
		default: 'national',
		displayOptions: { show: { '@version': [6] } },
		description:
			'Shape of the written value. Reading the input does not depend on it: "+33 3 20 00 00 00", "0320000000" and "0033 3 20 00 00 00" give the same result.',
		options: [
			{ name: 'National (03 20 00 00 00)', value: 'national' },
			{ name: 'International (+33 3 20 00 00 00)', value: 'international' },
			{ name: 'E.164 (+33320000000)', value: 'e164' },
			{ name: 'Custom Mask', value: 'mask' },
		],
	},
	{
		displayName: 'Default Country',
		name: 'defaultCountry',
		type: 'options',
		// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-options -- the options are generated (`PHONE_COUNTRY_OPTIONS`, FR included); the rule only reads a literal array, and its autofix would empty this default
		default: 'FR',
		displayOptions: { show: { '@version': [6] } },
		description:
			'Country used to read a number written in national format. An input starting with "+" or "00" is read as international and ignores this setting. Every country of the embedded numbering plans is listed (generated from the libphonenumber metadata, no runtime dependency); a number of a non-geographic service such as +800 is left untouched, with code FT_PHONE_PLAN_UNSUPPORTED.',
		options: [...PHONE_COUNTRY_OPTIONS],
	},
	{
		displayName: 'Mask',
		name: 'phoneMask',
		type: 'options',
		default: '0# ## ## ## ##',
		displayOptions: { show: { phoneOutput: ['mask'], '@version': [6] } },
		description:
			'Grammar of typeVersion 6: only "#" is a digit slot, a "#" preceded by a backslash is a literal, everything else is copied as is. The mask consumes the national significant number — nine digits in France — so it fits the numbers of one length only. A mask without any slot, or a typeVersion 5 mask left in its curly-brace form, fails the node at configuration time.',
		typeOptions: {
			allowCustomValues: true,
		},
		options: [
			{ name: '0# ## ## ## ## (FR National)', value: '0# ## ## ## ##' },
			{ name: '+33 # ## ## ## ## (FR International)', value: '+33 # ## ## ## ##' },
			{
				name: '+33 (0) # ## ## ## ## (FR, Literal Calling Code and 0)',
				value: '+33 (0) # ## ## ## ##',
			},
			{ name: '(###) ###-#### (US)', value: '(###) ###-####' },
		],
	},
];
