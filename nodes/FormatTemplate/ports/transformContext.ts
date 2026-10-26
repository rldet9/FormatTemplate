/**
 * `TransformContext` — what a transformation may ask of the outside world
 *
 * @version 1.0.0
 * @module FormatTemplate/ports/transformContext
 *
 * @description
 * A transformation stays a function of its value and parameters (ADR-0007);
 * when it needs a service, it receives it through this context, built once
 * per execution by the n8n adapter. Tests give it fakes.
 *
 * Interfaces only — no implementation, no import of `n8n-workflow`.
 */

import type { Geocoder, GeocoderSettings } from './geocoder';

/** Services offered to the transformations of one execution. */
export interface TransformContext {
	/**
	 * The geocoder of a configuration.
	 *
	 * @param settings - Service URL, timeout, retries and rate limit of the row
	 * @returns A geocoder shared by every item of the execution with the same
	 *          configuration — one cache, one rate limit
	 */
	geocoder(settings: GeocoderSettings): Geocoder;
}
