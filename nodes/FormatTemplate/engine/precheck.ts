/**
 * Configuration check, before the loop
 *
 * @version 1.0.0
 * @module FormatTemplate/engine/precheck
 *
 * @description
 * ADR-0001: a faulty setup fails the node **before** touching the first
 * item — "this is not faulty data, it is a faulty setup". The check specific
 * to a transformation (the phone mask) lives in that module's `validateRow`.
 *
 * The check covers **literal** values only; a row whose parameter is an
 * expression can only be judged item by item, in the loop, where it fails in
 * the same way.
 *
 * Pure module — no import of `n8n-workflow`.
 */

import { FT_CODES, ftDiagnostic, type FtDiagnostic } from '../kernel/diagnostics';
import { parseFieldPath } from '../kernel/fieldPath';
import type { TransformModule } from '../kernel/transformModule';

/**
 * Looks for the first configuration error in the raw rows.
 *
 * @param rawRows - Rows as saved (`getNode().parameters`)
 * @param transforms - Registered modules
 * @returns First configuration diagnostic, or `undefined`
 *
 * @remarks
 * Order of the checks, per row: shape of the path and of the output path,
 * known type, then the `validateRow` of each module, in the order of the list.
 *
 * @example
 * ```ts
 * precheckRows([{ fieldPath: 'a-b', type: 'phone' }], TRANSFORM_MODULES);
 * // { code: 'FT_PATH_INVALID', parameter: 'fieldsToFormat.field[0].fieldPath', … }
 * ```
 */
export function precheckRows(
	rawRows: ReadonlyArray<Record<string, unknown>>,
	transforms: readonly TransformModule[],
): FtDiagnostic | undefined {
	for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
		const row = rawRows[rowIndex];

		const rawPath = row.fieldPath;
		if (typeof rawPath === 'string' && rawPath !== '' && !rawPath.startsWith('=')) {
			const parsed = parseFieldPath(rawPath);
			if (!parsed.ok) {
				return ftDiagnostic(
					parsed.reason === 'reserved' ? FT_CODES.PATH_RESERVED : FT_CODES.PATH_INVALID,
					parsed.message,
					{ parameter: `fieldsToFormat.field[${rowIndex}].fieldPath` },
				);
			}
		}

		const outputPath = row.outputPath;
		if (typeof outputPath === 'string' && outputPath.trim() !== '' && !outputPath.startsWith('=')) {
			const parsed = parseFieldPath(outputPath.trim());
			if (!parsed.ok) {
				return ftDiagnostic(
					parsed.reason === 'reserved' ? FT_CODES.PATH_RESERVED : FT_CODES.PATH_INVALID,
					parsed.message,
					{ parameter: `fieldsToFormat.field[${rowIndex}].outputPath` },
				);
			}
		}

		const type = row.type;
		if (typeof type === 'string' && type !== '' && !type.startsWith('=')) {
			if (!transforms.some((module) => module.type === type)) {
				return ftDiagnostic(FT_CODES.TYPE_UNKNOWN, `Unknown transformation type: "${type}".`, {
					parameter: `fieldsToFormat.field[${rowIndex}].type`,
				});
			}
		}

		for (const module of transforms) {
			const invalid = module.validateRow?.(row);
			if (invalid) {
				return {
					...invalid,
					parameter: invalid.parameter
						? `fieldsToFormat.field[${rowIndex}].${invalid.parameter}`
						: `fieldsToFormat.field[${rowIndex}]`,
				};
			}
		}
	}
	return undefined;
}
