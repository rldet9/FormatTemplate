/**
 * `country` module — conversion to ISO 3166-1 alpha-2 codes
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/country/module
 *
 * @description
 * Assembles the `country` slice: interface, pure function (`format.ts`) and
 * the table generated offline (`countryCodes.ts`).
 *
 * ⚠️ This module stays **offline**: it requires no port and never will
 * (ADR-0009, architecture test AR-05).
 *
 * Pure module — no runtime import of `n8n-workflow`.
 */

import { FT_CODES } from '../../kernel/diagnostics';
import type { TransformModule } from '../../kernel/transformModule';
import { formatCountry } from './format';
import { COUNTRY_PROPERTIES } from './properties';

/** The `country` transformation. */
export const countryModule: TransformModule = {
	type: 'country',
	displayName: 'Country Code',
	description: 'Convert country names to ISO 3166-1 alpha-2 codes (offline table)',
	properties: COUNTRY_PROPERTIES,
	codes: [FT_CODES.VALUE_EMPTY, FT_CODES.COUNTRY_UNKNOWN, FT_CODES.COUNTRY_ALPHA2_UNKNOWN],
	run: (value, params) => formatCountry(value, params),
};
