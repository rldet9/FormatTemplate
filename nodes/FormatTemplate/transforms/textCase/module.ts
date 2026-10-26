/**
 * `textCase` module — text case
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/textCase/module
 *
 * @description
 * Assembles the `textCase` slice: interface, pure function (`format.ts`) and
 * codes. No configuration check: every mode applies to any string.
 *
 * Pure module — no runtime import of `n8n-workflow`.
 */

import { FT_CODES } from '../../kernel/diagnostics';
import type { TransformModule } from '../../kernel/transformModule';
import { formatTextCase } from './format';
import { TEXT_CASE_PROPERTIES } from './properties';

/** The `textCase` transformation. */
export const textCaseModule: TransformModule = {
	type: 'textCase',
	displayName: 'Text Case',
	description: 'Change the case of a text: uppercase, lowercase, first letter or title case',
	properties: TEXT_CASE_PROPERTIES,
	// `TYPE_UNKNOWN`: a case mode absent from the menu (custom value or expression).
	codes: [FT_CODES.VALUE_EMPTY, FT_CODES.TEXT_NOT_STRING, FT_CODES.TYPE_UNKNOWN],
	run: (value, params) => formatTextCase(value, params),
};
