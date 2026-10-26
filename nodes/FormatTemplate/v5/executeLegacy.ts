/**
 * Execution loop of typeVersion 5 — **frozen**
 *
 * @version 5.0.0 (frozen)
 * @module FormatTemplate/v5/executeLegacy
 *
 * @description
 * The typeVersion 5 loop, moved out of the node class as is.
 *
 * ⚠️ **Fix nothing here.** ADR-0004: a workflow saved in typeVersion 5 is
 * never migrated on load. The defects below are therefore *present and
 * intended* in this file; they are frozen by
 * `__tests__/format-legacy-characterization.test.ts`. Its error messages stay
 * in French, as measured on a real instance (ADR-0012).
 *
 * Defects kept, in the order you meet them when reading:
 *
 * - a missing field is **skipped silently**;
 * - a `NodeOperationError` from a transformation crosses the loop and
 *   **destroys the whole batch**; `continueOnFail()` is never read;
 * - any other exception is logged and **the original item is pushed to the
 *   output**, untransformed, without any signal;
 * - no `_format`, no `metadata.messageHistory` entry;
 * - no `pairedItem`.
 *
 * The only departure from the original typeVersion 5: the transformations are
 * called as functions (`v5/legacyTransforms.ts`) instead of classes
 * instantiated by a registry, and logging goes through `this.logger`. Neither
 * has any observable effect on the output.
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { applyPatternV5, formatTextCaseV5, resolveCountryV5 } from './legacyTransforms';

/** Transformation types known to typeVersion 5. */
const LEGACY_TYPES = new Set(['phone', 'textCase', 'country']);

/** Case modes offered by the typeVersion 5 dropdown. */
const LEGACY_TEXT_CASES = new Set(['uppercase', 'lowercase', 'capitalize']);

/**
 * Checks the format of the property path — the typeVersion 5 check.
 *
 * @param executionContext - n8n context
 * @param fieldPath - Configured path
 * @param itemIndex - Index of the current item
 *
 * @remarks
 * This single syntactic check is the visible half of the path defect: it says
 * nothing about whether the path exists, and lets `France` through — the
 * **value** returned by an n8n expression.
 */
function validateFieldPath(
	executionContext: IExecuteFunctions,
	fieldPath: string,
	itemIndex: number,
): void {
	if (!fieldPath.match(/^[a-zA-Z_][a-zA-Z0-9_.]*$/)) {
		const errorMessage = `Format de chemin invalide: "${fieldPath}". Vous devez spécifier le nom de la propriété (comme "phone") et non sa valeur.`;
		throw new NodeOperationError(executionContext.getNode(), errorMessage, {
			itemIndex,
			runIndex: itemIndex,
			description: 'Erreur de configuration du chemin',
		});
	}
}

/**
 * Applies a typeVersion 5 transformation.
 *
 * @param executionContext - n8n context, to build the node error
 * @param type - Transformation type
 * @param value - Value already turned into a string by the caller
 * @param field - Configuration row
 * @returns Transformed value
 */
function transformV5(
	executionContext: IExecuteFunctions,
	type: string,
	value: string,
	field: IDataObject,
): string {
	if (type === 'phone') {
		return applyPatternV5(value, field.pattern as string);
	}
	if (type === 'textCase') {
		const mode = field.textCase as string;
		// `titleCase` only exists in typeVersion 6: no workflow saved in 5 can carry
		// it. Refusing it here changes nothing for an existing workflow, and prevents
		// a node left in 5 after an edit in the editor from returning the value
		// unchanged in silence (the `default` branch of `formatTextCaseV5`).
		if (!LEGACY_TEXT_CASES.has(mode)) {
			throw new NodeOperationError(
				executionContext.getNode(),
				`Le mode de casse "${mode}" n'existe qu'à partir de la typeVersion 6.`,
				{ description: 'Faites passer le node en typeVersion 6, ou choisissez un autre mode.' },
			);
		}
		return formatTextCaseV5(value, mode);
	}
	const resolved = resolveCountryV5(value);
	if (resolved.resolved) return resolved.value;

	// This error goes up out of the loop and takes the whole batch with it.
	throw new NodeOperationError(
		executionContext.getNode(),
		`Impossible de convertir "${value}" en code pays ISO2`,
		{
			description:
				'Aucune correspondance dans la table ISO 3166-1 embarquée (noms français, anglais et alias usuels). Vérifiez l’orthographe, ou fournissez directement le code à deux lettres.',
		},
	);
}

/**
 * Executes the node in typeVersion 5.
 *
 * @returns The items of the single output
 *
 * @example
 * ```ts
 * // From the node class
 * return executeLegacy.call(this);
 * ```
 */
export async function executeLegacy(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	this.logger.debug(`FormatTemplate: processing ${items.length} items`);

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			// Full clone of the item, to avoid shared references
			const item = items[itemIndex];
			const newItem: INodeExecutionData = {
				binary: item.binary ? JSON.parse(JSON.stringify(item.binary)) : undefined,
				json: JSON.parse(JSON.stringify(item.json)),
			};

			// Read the configuration of the fields to format
			const fields = this.getNodeParameter(
				'fieldsToFormat.field',
				itemIndex,
				[],
			) as IDataObject[];

			// Process each configured field
			for (const field of fields) {
				const fieldPath = field.fieldPath as string;
				if (!fieldPath) continue;

				validateFieldPath(this, fieldPath, itemIndex);

				// Read the current value
				const currentValue = getProp(newItem.json, fieldPath);

				// Missing field: skipped silently
				if (currentValue === undefined || currentValue === null) {
					continue;
				}

				const type = field.type as string;
				if (!LEGACY_TYPES.has(type)) {
					throw new NodeOperationError(
						this.getNode(),
						`Handler non trouvé pour le type "${type}"`,
					);
				}

				const newValue = transformV5(this, type, String(currentValue), field);

				if (newValue !== undefined) {
					setProp(newItem.json, fieldPath, newValue);
				}
			}

			returnData.push(newItem);
		} catch (error) {
			// The validation error goes up as is, out of the loop: the batch is lost.
			if (error.name === 'NodeOperationError') {
				throw error;
			}
			// Any other error is logged, and the original item — untransformed — is
			// pushed to the output without the slightest marker.
			this.logger.error(`FormatTemplate: error processing item ${itemIndex}`, {
				message: (error as Error).message,
			});
			returnData.push(items[itemIndex]);
		}
	}

	return [returnData];
}

/**
 * Reads a nested property by dotted path — typeVersion 5.
 *
 * @param obj - Root object
 * @param path - Dotted path
 * @returns Value read, or `undefined`
 */
function getProp(obj: IDataObject, path: string): unknown {
	return path
		.split('.')
		.reduce(
			(o: unknown, key) =>
				o && typeof o === 'object' ? (o as Record<string, unknown>)[key] : undefined,
			obj,
		);
}

/**
 * Writes a nested property by dotted path — typeVersion 5.
 *
 * @param obj - Root object, mutated in place
 * @param path - Dotted path
 * @param value - Value to write
 */
function setProp(obj: IDataObject, path: string, value: unknown): void {
	const parts = path.split('.');
	let cur: IDataObject = obj;

	// Walk down to the parent of the final property
	for (let i = 0; i < parts.length - 1; i++) {
		const p = parts[i];
		if (cur[p] === undefined) {
			cur[p] = {} as IDataObject;
		} else if (typeof cur[p] !== 'object') {
			cur[p] = {} as IDataObject;
		}
		cur = cur[p] as IDataObject;
	}

	const lastPart = parts[parts.length - 1];
	(cur as Record<string, unknown>)[lastPart] = value;
}
