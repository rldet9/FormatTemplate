/**
 * `phone` module — phone number normalization
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/phone/module
 *
 * @description
 * Assembles the `phone` slice: interface, pure function (`format.ts`),
 * reading (`read.ts`) and rendering (`render.ts`) on the generated numbering
 * plans of every country (`plans.ts`, `numberingPlans.ts`), codes and the
 * configuration check of the mask.
 *
 * Pure module — no runtime import of `n8n-workflow`.
 */

import { FT_CODES } from '../../kernel/diagnostics';
import type { TransformModule } from '../../kernel/transformModule';
import { formatPhone, validateMask } from './format';
import { PHONE_PROPERTIES } from './properties';

/** The `phone` transformation. */
export const phoneModule: TransformModule = {
	type: 'phone',
	displayName: 'Phone',
	description: 'Normalize phone numbers: national, international, E.164 or custom mask',
	properties: PHONE_PROPERTIES,
	codes: [
		FT_CODES.VALUE_EMPTY,
		FT_CODES.PHONE_MASK_INVALID,
		FT_CODES.PHONE_LENGTH_MISMATCH,
		FT_CODES.PHONE_NUMERIC_INPUT,
		FT_CODES.PHONE_UNPARSEABLE,
		FT_CODES.PHONE_PLAN_UNSUPPORTED,
		FT_CODES.PHONE_NOT_IN_PLAN,
		FT_CODES.PHONE_FORMAT_UNAVAILABLE,
	],
	validateRow(row) {
		// Only a literal mask can be judged before the loop; an expression waits for
		// its item, and `formatPhone` then refuses it in the same way.
		const mask = row.phoneMask;
		if (row.phoneOutput !== 'mask' || typeof mask !== 'string' || mask.startsWith('=')) {
			return undefined;
		}
		return validateMask(mask);
	},
	run: (value, params) => formatPhone(value, params),
};
