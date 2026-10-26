/**
 * Interface parameters of a `textCase` row
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/textCase/properties
 *
 * @description
 * Declared without the condition on `type`, which `scopeToTransform` adds.
 * `Case` exists in both typeVersions; `locale` only in typeVersion 6.
 */

import type { INodeProperties } from 'n8n-workflow';

/** Parameters of a `textCase` row, in display order. */
export const TEXT_CASE_PROPERTIES: readonly INodeProperties[] = [
	{
		displayName: 'Case',
		name: 'textCase',
		type: 'options',
		default: 'uppercase',
		options: [
			{ name: 'UPPERCASE', value: 'uppercase' },
			{ name: 'Lowercase', value: 'lowercase' },
			// Relabelled on purpose: the mode does not do what "Capitalize" suggests (ADR-0004).
			{
				name: 'First Letter of the String (Rest in Lowercase)',
				value: 'capitalize',
				description:
					'Uppercases the first character of the string and lowercases everything else: "SARL DUPONT" becomes "Sarl dupont"',
			},
			{
				name: 'Title Case (typeVersion 6 Only)',
				value: 'titleCase',
				description:
					'Uppercase after the start of the string, a space, a hyphen, an apostrophe, a period, a slash or an opening parenthesis: "SARL DUPONT ET FILS" becomes "Sarl Dupont Et Fils". No particle rules. A node in typeVersion 5 rejects this mode.',
			},
		],
	},
	{
		displayName: 'Locale',
		name: 'locale',
		type: 'string',
		default: 'fr-FR',
		displayOptions: { show: { '@version': [6] } },
		description: 'Locale used for case changes. typeVersion 5 always uses "fr-FR".',
		placeholder: 'fr-FR',
	},
];
