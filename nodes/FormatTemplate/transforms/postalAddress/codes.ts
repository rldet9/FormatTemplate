/**
 * Diagnostic codes of the postal-address transformation
 *
 * @version 2.0.0
 * @module FormatTemplate/transforms/postalAddress/codes
 *
 * @description
 * A short-named view of the `FT_ADDRESS_*` codes of the public catalogue
 * (`kernel/diagnostics.ts`, documented in `docs/DIAGNOSTICS.md`). The values
 * are the catalogue's: there is a single source of truth.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { FT_CODES } from '../../kernel/diagnostics';

/** Codes of the postal-address transformation. */
export const ADDRESS_CODES = {
	INPUT_UNREADABLE: FT_CODES.ADDRESS_INPUT_UNREADABLE,
	COUNTRY_UNSUPPORTED: FT_CODES.ADDRESS_COUNTRY_UNSUPPORTED,
	SPECIAL_DISTRIBUTION: FT_CODES.ADDRESS_SPECIAL_DISTRIBUTION,
	NOT_FOUND: FT_CODES.ADDRESS_NOT_FOUND,
	AMBIGUOUS: FT_CODES.ADDRESS_AMBIGUOUS,
	IMPRECISE: FT_CODES.ADDRESS_IMPRECISE,
	MISMATCH: FT_CODES.ADDRESS_MISMATCH,
	CORRECTED: FT_CODES.ADDRESS_CORRECTED,
	LINE_TOO_LONG: FT_CODES.ADDRESS_LINE_TOO_LONG,
	ENDPOINT_INVALID: FT_CODES.ADDRESS_ENDPOINT_INVALID,
	SERVICE_UNAVAILABLE: FT_CODES.ADDRESS_SERVICE_UNAVAILABLE,
	RATE_LIMITED: FT_CODES.ADDRESS_RATE_LIMITED,
	SERVICE_REJECTED: FT_CODES.ADDRESS_SERVICE_REJECTED,
} as const;
