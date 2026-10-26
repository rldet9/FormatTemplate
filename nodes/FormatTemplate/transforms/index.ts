/**
 * The list of transformations — constant and ordered
 *
 * @version 2.0.0
 * @module FormatTemplate/transforms
 *
 * @description
 * ADR-0010: the list is a **constant**. No dynamic discovery, no promise of
 * hot extension, and the dropdown order is the order of this array, never an
 * import order. (An earlier "auto-discovery" registry promised extension at
 * runtime and never delivered it: it was removed.)
 *
 * Adding a transformation: write `transforms/<type>/` on the model of the
 * existing ones, then register it here — see `docs/ARCHITECTURE.md`.
 *
 * Pure module — no runtime import of `n8n-workflow`.
 */

import type { INodeProperties } from 'n8n-workflow';

import { scopeToTransform, type TransformModule } from '../kernel/transformModule';
import type { TransformContext } from '../ports/transformContext';
import { countryModule } from './country/module';
import { phoneModule } from './phone/module';
import { postalAddressModule } from './postalAddress/module';
import { textCaseModule } from './textCase/module';

/**
 * The node's transformations, in menu order.
 *
 * @remarks
 * This is where the modules meet the services they may ask for: the list is
 * typed with the node's `TransformContext`, which the kernel and the engine do
 * not know (ADR-0010).
 *
 * The array is frozen, not its elements: the engine calls `module.run` at call
 * time, which lets a test replace a transform (FTN-04).
 */
export const TRANSFORM_MODULES: readonly TransformModule<TransformContext>[] = Object.freeze([
	phoneModule,
	textCaseModule,
	countryModule,
	postalAddressModule,
]);

/**
 * Row parameters of every transformation, each restricted to its type.
 *
 * @returns Parameters to place after `fieldPath` and `type` in `fieldsToFormat.field`
 */
export function transformRowProperties(): INodeProperties[] {
	return TRANSFORM_MODULES.flatMap((module) => scopeToTransform(module.type, module.properties));
}
