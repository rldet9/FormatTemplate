/**
 * Rendering a phone number in the shape of its numbering plan
 *
 * @version 2.0.0
 * @module FormatTemplate/transforms/phone/render
 *
 * @description
 * libphonenumber's `format`, on the generated plans (ADR-0016): the first
 * format of the plan whose leading digits and pattern match the national
 * significant number (NSN) groups its digits.
 *
 * - **national**: the national template, national prefix included where the
 *   plan writes it (`03 20 00 00 00`, `020 7946 0958`, `06 1234 5678`);
 * - **international**: `+`, the calling code, a space, the international
 *   template (`+44 20 7946 0958`);
 * - **e164**: `+`, the calling code and the NSN, without separator.
 *
 * A number of a shared calling code is rendered with the formats of the main
 * territory of the code, as in libphonenumber.
 *
 * When the plan has no format for the number, libphonenumber writes the digits
 * ungrouped. The node does so too, except in one case (ADR-0002): a national
 * rendering in a plan that has a national prefix, since nothing says whether
 * the prefix is written for that number. It then says so with
 * `FT_PHONE_FORMAT_UNAVAILABLE` and leaves the value untouched.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { FT_CODES, ftDiagnostic, type FtDiagnostic } from '../../kernel/diagnostics';
import { replaceWhole } from './patterns';
import { chooseFormat, renderingPlan } from './plans';
import type { PhoneNumber } from './read';

/** Shapes rendered from the plan; the custom mask is `format.ts`'s business. */
export type PlanOutput = 'national' | 'international' | 'e164';

/** Result of a rendering. */
export type RenderResult = { ok: true; value: string } | { ok: false; diagnostic: FtDiagnostic };

/**
 * Renders a phone number.
 *
 * @param number - Number read by `readPhoneNumber`
 * @param output - Shape to render
 * @returns Rendered value, or the diagnostic of the failure
 *
 * @example
 * ```ts
 * renderPhoneNumber({ callingCode: '44', nsn: '2079460958' }, 'national');      // '020 7946 0958'
 * renderPhoneNumber({ callingCode: '44', nsn: '2079460958' }, 'international'); // '+44 20 7946 0958'
 * renderPhoneNumber({ callingCode: '44', nsn: '2079460958' }, 'e164');          // '+442079460958'
 * ```
 */
export function renderPhoneNumber(number: PhoneNumber, output: PlanOutput): RenderResult {
	const { callingCode, nsn } = number;
	if (output === 'e164') return { ok: true, value: `+${callingCode}${nsn}` };

	const { iso2, plan } = renderingPlan(callingCode);
	const format = chooseFormat(plan, nsn, output === 'international');

	if (output === 'international') {
		const template = format ? (format.international ?? format.format) : undefined;
		const grouped = format && template ? replaceWhole(format.pattern, nsn, template) : nsn;
		return { ok: true, value: `+${callingCode} ${grouped}` };
	}

	if (format) return { ok: true, value: replaceWhole(format.pattern, nsn, format.national ?? format.format) };
	if (plan.nationalPrefix === undefined) return { ok: true, value: nsn };
	return {
		ok: false,
		diagnostic: ftDiagnostic(
			FT_CODES.PHONE_FORMAT_UNAVAILABLE,
			`The ${iso2} numbering plan defines no national grouping for this number, and it writes a national ` +
				'prefix: nothing says whether this number takes it. Use the international or e164 output.',
		),
	};
}
