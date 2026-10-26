/**
 * `TransformModule` — the contract of a node transformation
 *
 * @version 1.0.0
 * @module FormatTemplate/kernel/transformModule
 *
 * @description
 * A transformation is a **vertical slice** (ADR-0010): its interface, its
 * pure function, its diagnostic codes and its configuration check live
 * together in `transforms/<type>/`. The node only knows it through this
 * contract.
 *
 * There is **no** dynamic discovery: `transforms/index.ts` holds the constant
 * list of modules, and the menu order is the order of that file.
 *
 * Pure module — `n8n-workflow` is imported as a **type** only (erased at
 * compile time): no runtime dependency.
 */

import type { INodeProperties } from 'n8n-workflow';

import type { FtDiagnostic } from './diagnostics';
import type { FormatOutcome } from './outcome';

/**
 * A field transformation.
 *
 * @typeParam Context - Services the transformation needs from the execution (a
 *   geocoder…). The kernel does not know them: `transforms/index.ts` binds the
 *   context of the node's modules, and the engine passes it through untouched.
 *
 * @remarks
 * The engine calls `run` **by property lookup at call time**: a test can
 * therefore replace a module's `run` (`jest.spyOn`) to simulate a failing
 * transform.
 */
export interface TransformModule<Context = unknown> {
	/** Stable identifier, written into workflows — never rename it. */
	readonly type: string;
	/** Name shown in the `type` dropdown. */
	readonly displayName: string;
	/** Description shown under the option. */
	readonly description: string;
	/**
	 * Row parameters of the module, **without** the condition on `type`.
	 *
	 * @remarks
	 * {@link scopeToTransform} adds `type: [<type>]` at the head of
	 * `displayOptions.show`; the `@version` condition is declared by the module
	 * itself, which knows in which typeVersion each parameter exists.
	 */
	readonly properties: readonly INodeProperties[];
	/** `FT_*` codes the module may emit — checked by the architecture tests. */
	readonly codes: readonly string[];
	/**
	 * Looks for a **configuration** error on a raw row, before the loop.
	 *
	 * @param row - Row as saved (`getNode().parameters`), expressions included
	 * @returns Configuration diagnostic, or `undefined`
	 *
	 * @remarks
	 * Called on **every** row, whatever its type: a module only reads its own
	 * parameters, which n8n only saves on the rows that display them. A value
	 * written as an expression (`=…`) can only be judged item by item, in
	 * `run`. The diagnostic's `parameter` is the local name (`phoneMask`): the
	 * engine prefixes it with `fieldsToFormat.field[<n>].`.
	 */
	validateRow?(row: Readonly<Record<string, unknown>>): FtDiagnostic | undefined;
	/**
	 * Transforms a value.
	 *
	 * @param value - Value read from the item, **unconverted**
	 * @param params - Row configuration resolved for the item
	 * @param context - Services of the execution (a geocoder…), for the
	 *                  transformations that need one
	 * @returns Typed result, or its promise
	 *
	 * @remarks
	 * Does not throw by contract (ADR-0007); an exception is caught by the
	 * engine and becomes `FT_INTERNAL_ERROR`.
	 */
	run(
		value: unknown,
		params: Record<string, unknown>,
		context: Context,
	): FormatOutcome | Promise<FormatOutcome>;
}

/**
 * Restricts a module's parameters to the rows of its type.
 *
 * @param type - Type of the module
 * @param properties - Parameters declared by the module
 * @returns Parameters whose `displayOptions.show.type` is `[type]`
 *
 * @example
 * ```ts
 * scopeToTransform('phone', [{ name: 'phoneOutput', displayOptions: { show: { '@version': [6] } } }]);
 * // [{ name: 'phoneOutput', displayOptions: { show: { type: ['phone'], '@version': [6] } } }]
 * ```
 */
export function scopeToTransform(
	type: string,
	properties: readonly INodeProperties[],
): INodeProperties[] {
	return properties.map((property) => ({
		...property,
		displayOptions: {
			...property.displayOptions,
			show: { type: [type], ...property.displayOptions?.show },
		},
	}));
}
