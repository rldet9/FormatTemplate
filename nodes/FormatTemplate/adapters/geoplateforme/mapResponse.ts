/**
 * Reading an answer of the Géoplateforme geocoding service
 *
 * @version 1.0.0
 * @module FormatTemplate/adapters/geoplateforme/mapResponse
 *
 * @description
 * The Géoplateforme geocoding service (IGN, `data.geopf.fr/geocodage`) answers
 * a search with a GeoJSON `FeatureCollection`; on its `address` index, every
 * feature is an entry of the Base Adresse Nationale. This module turns that
 * answer into the service-independent {@link AddressCandidate}s of the
 * `Geocoder` port.
 *
 * Pure function — the HTTP call itself is another module. An answer that is
 * not a `FeatureCollection` is a **technical** fault of the service, and is
 * thrown as such; it must never read as "no address found".
 */

import type { AddressCandidate, AddressPrecision } from '../../ports/geocoder';

/** Feature types of the address index, mapped to the port's precisions. */
const PRECISIONS: Readonly<Record<string, AddressPrecision>> = {
	housenumber: 'housenumber',
	street: 'street',
	locality: 'locality',
	municipality: 'municipality',
};

/**
 * Reads a non-empty string property.
 *
 * @param properties - Feature properties
 * @param key - Property name
 * @returns The string, or `undefined`
 */
function text(properties: Record<string, unknown>, key: string): string | undefined {
	const value = properties[key];
	return typeof value === 'string' && value.trim() !== '' ? value.trim().replace(/\s+/g, ' ') : undefined;
}

/**
 * Maps a search answer to candidates.
 *
 * @param body - Parsed JSON body of a `/search` answer
 * @returns Candidates, in the service's order
 *
 * @throws TypeError when the body is not a GeoJSON `FeatureCollection`
 *
 * @example
 * ```ts
 * mapSearchResponse({ type: 'FeatureCollection', features: [] }); // []
 * ```
 */
export function mapSearchResponse(body: unknown): AddressCandidate[] {
	const collection = body as { type?: unknown; features?: unknown };
	if (!collection || collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
		throw new TypeError('The geocoding service did not answer with a GeoJSON FeatureCollection.');
	}

	return collection.features.flatMap((feature: unknown): AddressCandidate[] => {
		const properties = (feature as { properties?: Record<string, unknown> })?.properties;
		if (!properties || typeof properties !== 'object') return [];
		const label = text(properties, 'label');
		const score = properties.score;
		if (!label || typeof score !== 'number') return [];

		const coordinates = (feature as { geometry?: { coordinates?: unknown } }).geometry?.coordinates;
		const [longitude, latitude] = Array.isArray(coordinates) ? coordinates : [];

		const candidate: AddressCandidate = {
			label,
			score,
			precision: PRECISIONS[String(properties.type)] ?? 'municipality',
		};
		const optional: Array<[keyof AddressCandidate, string]> = [
			['housenumber', 'housenumber'],
			['street', 'street'],
			['name', 'name'],
			['postcode', 'postcode'],
			['city', 'city'],
			['citycode', 'citycode'],
			['oldCity', 'oldcity'],
			['district', 'district'],
			['context', 'context'],
			['id', 'id'],
			['banId', 'banId'],
		];
		for (const [field, key] of optional) {
			const value = text(properties, key);
			if (value !== undefined) (candidate as unknown as Record<string, unknown>)[field] = value;
		}
		if (typeof latitude === 'number' && typeof longitude === 'number') {
			candidate.latitude = latitude;
			candidate.longitude = longitude;
		}
		return [candidate];
	});
}
