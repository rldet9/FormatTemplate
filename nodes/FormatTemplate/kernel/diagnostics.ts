/**
 * `FT_*` diagnostics — the stable codes of the `formatTemplate` node
 *
 * @version 1.0.0
 * @module FormatTemplate/kernel/diagnostics
 *
 * @description
 * Pure kernel module. A diagnostic is the only way a transform reports what
 * happened to a value: no exception crosses the batch (ADR-0001, ADR-0007).
 *
 * ⚠️ No import of `n8n-workflow` here: these functions must stay testable
 * outside any n8n context. A diagnostic becomes a `NodeOperationError` **at
 * the boundary only**, in `executeV6.ts`.
 *
 * ⚠️ The folder is self-contained (ADR-0010): it is published and deployed on
 * its own, so it never imports a sibling package's shared code — such an
 * import would compile and then fail at runtime.
 */

/**
 * Stable diagnostic codes.
 *
 * @remarks
 * These codes are part of the public contract: they are readable in `_format`
 * and in the node's error message. Never rename one without a new typeVersion
 * (ADR-0012 — the code is the contract, the message is not).
 */
export const FT_CODES = {
	// --- Field path --------------------------------------------------------
	/** `fieldPath` is not a property path — a **configuration** error. */
	PATH_INVALID: 'FT_PATH_INVALID',
	/** The parameter was an n8n expression: the resolved path is probably a **value**. */
	PATH_FROM_EXPRESSION: 'FT_PATH_FROM_EXPRESSION',
	/** Valid path, missing from the item. */
	PATH_NOT_FOUND: 'FT_PATH_NOT_FOUND',
	/** Path targeting a reserved key (`__proto__`, `constructor`, `prototype`). */
	PATH_RESERVED: 'FT_PATH_RESERVED',

	// --- Value -------------------------------------------------------------
	/** Empty value (`''`, `null`, `undefined`) — nothing to transform. */
	VALUE_EMPTY: 'FT_VALUE_EMPTY',

	// --- Row configuration ------------------------------------------------
	/** Unregistered transformation type — a **configuration** error. */
	TYPE_UNKNOWN: 'FT_TYPE_UNKNOWN',

	// --- Phone -------------------------------------------------------------
	/** Mask without any `#` slot — a **configuration** error. */
	PHONE_MASK_INVALID: 'FT_PHONE_MASK_INVALID',
	/**
	 * Number of digits ≠ a length of the numbering plan or the capacity of the mask; also a
	 * national input without the national prefix its plan writes (`320000000` in France).
	 */
	PHONE_LENGTH_MISMATCH: 'FT_PHONE_LENGTH_MISMATCH',
	/** Numeric value: a leading zero may have been lost **before** the node. */
	PHONE_NUMERIC_INPUT: 'FT_PHONE_NUMERIC_INPUT',
	/** No usable digit. */
	PHONE_UNPARSEABLE: 'FT_PHONE_UNPARSEABLE',
	/**
	 * Numbering plan not in the table.
	 *
	 * @remarks
	 * ADR-0016: the table holds every country of the libphonenumber metadata. This
	 * diagnostic remains for a calling code assigned to no country (non-geographic
	 * services such as +800, unassigned codes) and for a `defaultCountry` the table
	 * does not hold. The value is **left untouched** rather than truncated.
	 */
	PHONE_PLAN_UNSUPPORTED: 'FT_PHONE_PLAN_UNSUPPORTED',
	/** The digits have a length of the plan but are not a number of it (no area code starts that way). */
	PHONE_NOT_IN_PLAN: 'FT_PHONE_NOT_IN_PLAN',
	/** The plan defines no national grouping for this number and writes a national prefix. */
	PHONE_FORMAT_UNAVAILABLE: 'FT_PHONE_FORMAT_UNAVAILABLE',

	// --- Text --------------------------------------------------------------
	/** Non-text value submitted to `textCase`. */
	TEXT_NOT_STRING: 'FT_TEXT_NOT_STRING',

	// --- Country -----------------------------------------------------------
	/** No ISO 3166-1 match. */
	COUNTRY_UNKNOWN: 'FT_COUNTRY_UNKNOWN',
	/** Two letters outside the standard. */
	COUNTRY_ALPHA2_UNKNOWN: 'FT_COUNTRY_ALPHA2_UNKNOWN',

	// --- Postal address (ADR-0013, ADR-0014) --------------------------------
	/** Neither a text nor an object the transformation can read, or nothing left to geocode. */
	ADDRESS_INPUT_UNREADABLE: 'FT_ADDRESS_INPUT_UNREADABLE',
	/** The address is outside the territories the national address base covers. */
	ADDRESS_COUNTRY_UNSUPPORTED: 'FT_ADDRESS_COUNTRY_UNSUPPORTED',
	/** A CEDEX, post-office box or mail sorting mention: not a geographical address. */
	ADDRESS_SPECIAL_DISTRIBUTION: 'FT_ADDRESS_SPECIAL_DISTRIBUTION',
	/** No candidate, or the best one scores below the minimum. */
	ADDRESS_NOT_FOUND: 'FT_ADDRESS_NOT_FOUND',
	/** Two different addresses match the input almost equally. */
	ADDRESS_AMBIGUOUS: 'FT_ADDRESS_AMBIGUOUS',
	/** The best match is less precise than required (street instead of house number). */
	ADDRESS_IMPRECISE: 'FT_ADDRESS_IMPRECISE',
	/** The best match disagrees with the input: another street, number or place. */
	ADDRESS_MISMATCH: 'FT_ADDRESS_MISMATCH',
	/** The address was accepted, or refused, after a correction; the message names the fields. */
	ADDRESS_CORRECTED: 'FT_ADDRESS_CORRECTED',
	/** A formatted line exceeds 38 characters after the authorized abbreviations. */
	ADDRESS_LINE_TOO_LONG: 'FT_ADDRESS_LINE_TOO_LONG',
	/** The geocoding service URL is not an HTTPS URL — a **configuration** error. */
	ADDRESS_ENDPOINT_INVALID: 'FT_ADDRESS_ENDPOINT_INVALID',

	// --- Geocoding service: **technical** failures (ADR-0015) ---------------
	/** No answer, a timeout, a 5xx status or an unreadable answer, after the retries. */
	ADDRESS_SERVICE_UNAVAILABLE: 'FT_ADDRESS_SERVICE_UNAVAILABLE',
	/** The service kept asking to slow down (429), after the retries. */
	ADDRESS_RATE_LIMITED: 'FT_ADDRESS_RATE_LIMITED',
	/** The service refused the request (a 4xx status other than 429). */
	ADDRESS_SERVICE_REJECTED: 'FT_ADDRESS_SERVICE_REJECTED',

	// --- Engine ------------------------------------------------------------
	/** Unexpected exception in a transform — replaces the former silent fallback (ADR-0007). */
	INTERNAL_ERROR: 'FT_INTERNAL_ERROR',
} as const;

/** Union of the known diagnostic codes. */
export type FtDiagnosticCode = (typeof FT_CODES)[keyof typeof FT_CODES];

/** Severity of a diagnostic. */
export type FtSeverity = 'error' | 'warning' | 'info';

/**
 * Structured diagnostic of the `formatTemplate` node.
 *
 * @remarks
 * ADR-0006: `message` **never** carries the processed value. Values are
 * people's names and phone numbers; they are written only on
 * `options.traceValues`, explicitly.
 */
export interface FtDiagnostic {
	/** Stable code, from {@link FT_CODES}. */
	code: string;
	/** Readable message, free of any personal data. */
	message: string;
	/** Field path concerned (`contact.mobile`). */
	path?: string;
	/** Name of the node parameter at fault, for a configuration error. */
	parameter?: string;
	/** Index of the input item concerned. */
	itemIndex?: number;
	/** Severity; read as `error` when absent. */
	severity?: FtSeverity;
}

/**
 * Builds a diagnostic, leaving out the fields that are not set.
 *
 * @param code - Stable diagnostic code
 * @param message - Readable message, without personal data
 * @param extra - Optional location (path, parameter, itemIndex, severity)
 * @returns Normalized diagnostic
 *
 * @example
 * ```ts
 * ftDiagnostic(FT_CODES.PHONE_LENGTH_MISMATCH, '8 digit(s) for 9 mask slot(s).', {
 *   path: 'contact.mobile',
 * });
 * ```
 */
export function ftDiagnostic(
	code: string,
	message: string,
	extra: Omit<FtDiagnostic, 'code' | 'message'> = {},
): FtDiagnostic {
	const result: FtDiagnostic = { code, message };
	if (extra.path !== undefined) result.path = extra.path;
	if (extra.parameter !== undefined) result.parameter = extra.parameter;
	if (extra.itemIndex !== undefined) result.itemIndex = extra.itemIndex;
	if (extra.severity !== undefined) result.severity = extra.severity;
	return result;
}

/**
 * Codes that belong to the node's **configuration**, not to the data.
 *
 * @remarks
 * ADR-0001: these fail the whole node whatever the `onFieldError` policy —
 * "this is not faulty data, it is a faulty setup".
 */
const CONFIGURATION_CODES: ReadonlySet<string> = new Set([
	FT_CODES.PATH_INVALID,
	FT_CODES.PATH_RESERVED,
	FT_CODES.TYPE_UNKNOWN,
	FT_CODES.PHONE_MASK_INVALID,
	FT_CODES.ADDRESS_ENDPOINT_INVALID,
]);

/**
 * Codes of a **technical** failure: a service the transformation depends on
 * did not answer properly.
 *
 * @remarks
 * ADR-0015: a technical failure is never a verdict on the data. It follows its
 * own policy, `onServiceError` (fail the node by default, so that n8n's own
 * retry settings can replay the execution), and never `onFieldError`.
 */
const TECHNICAL_CODES: ReadonlySet<string> = new Set([
	FT_CODES.ADDRESS_SERVICE_UNAVAILABLE,
	FT_CODES.ADDRESS_RATE_LIMITED,
	FT_CODES.ADDRESS_SERVICE_REJECTED,
]);

/**
 * Tells whether a diagnostic is a configuration error.
 *
 * @param diagnostic - Diagnostic to classify
 * @returns `true` if the node must fail regardless of `onFieldError`
 *
 * @example
 * ```ts
 * isConfigurationDiagnostic(ftDiagnostic(FT_CODES.PATH_INVALID, '…')); // true
 * isConfigurationDiagnostic(ftDiagnostic(FT_CODES.COUNTRY_UNKNOWN, '…')); // false
 * ```
 */
export function isConfigurationDiagnostic(diagnostic: FtDiagnostic): boolean {
	return CONFIGURATION_CODES.has(diagnostic.code);
}

/**
 * Tells whether a diagnostic is a technical failure of a service.
 *
 * @param diagnostic - Diagnostic to classify
 * @returns `true` if `onServiceError`, not `onFieldError`, applies
 *
 * @example
 * ```ts
 * isTechnicalDiagnostic(ftDiagnostic(FT_CODES.ADDRESS_SERVICE_UNAVAILABLE, '…')); // true
 * isTechnicalDiagnostic(ftDiagnostic(FT_CODES.ADDRESS_NOT_FOUND, '…'));           // false
 * ```
 */
export function isTechnicalDiagnostic(diagnostic: FtDiagnostic): boolean {
	return TECHNICAL_CODES.has(diagnostic.code);
}

/**
 * Describes a value without disclosing its content.
 *
 * @param value - Any value
 * @returns Type summary, safe to put in a diagnostic message
 *
 * @example
 * ```ts
 * describeFtValue('0612345678'); // 'string(10 characters)'
 * describeFtValue(42);           // 'number'
 * ```
 */
export function describeFtValue(value: unknown): string {
	if (value === null) return 'null';
	if (value === undefined) return 'undefined';
	if (Array.isArray(value)) return `array(${value.length} items)`;
	if (typeof value === 'string') return `string(${value.length} characters)`;
	if (typeof value === 'object') return `object(${Object.keys(value as object).length} keys)`;
	return typeof value;
}
