/**
 * Géoplateforme adapter — reading an answer (GP-M*)
 *
 * @module FormatTemplate/__tests__/geoplateforme-map-response
 */

import { mapSearchResponse } from '../adapters/geoplateforme/mapResponse';

/** A feature of the address index, as the service writes it. */
const FEATURE = {
	type: 'Feature',
	geometry: { type: 'Point', coordinates: [2.290084, 49.897442] },
	properties: {
		label: '8 Boulevard du Port 80000 Amiens',
		score: 0.656,
		housenumber: '8',
		id: '80021_6590_00008',
		banId: 'f2633629-5541-4233-aa54-3c2eb58aa8b9',
		name: '8 Boulevard du Port',
		postcode: '80000',
		citycode: '80021',
		x: 648952.58,
		y: 6977867.14,
		city: 'Amiens',
		context: '80, Somme, Hauts-de-France',
		type: 'housenumber',
		importance: 0.67792,
		street: 'Boulevard du Port',
		_type: 'address',
	},
};

describe('GP-M01 — mapping', () => {
	it('maps a feature to a candidate, longitude and latitude in the right order', () => {
		// Assert — GeoJSON writes [longitude, latitude]
		expect(mapSearchResponse({ type: 'FeatureCollection', features: [FEATURE] })).toEqual([
			{
				label: '8 Boulevard du Port 80000 Amiens',
				score: 0.656,
				precision: 'housenumber',
				housenumber: '8',
				street: 'Boulevard du Port',
				name: '8 Boulevard du Port',
				postcode: '80000',
				city: 'Amiens',
				citycode: '80021',
				context: '80, Somme, Hauts-de-France',
				id: '80021_6590_00008',
				banId: 'f2633629-5541-4233-aa54-3c2eb58aa8b9',
				latitude: 49.897442,
				longitude: 2.290084,
			},
		]);
	});

	it('maps oldcity to oldCity, and collapses double spaces', () => {
		// Act
		const [candidate] = mapSearchResponse({
			type: 'FeatureCollection',
			features: [{ ...FEATURE, properties: { ...FEATURE.properties, street: 'Place  Saint-Honoré', oldcity: 'Lille' } }],
		});

		// Assert
		expect(candidate).toMatchObject({ street: 'Place Saint-Honoré', oldCity: 'Lille' });
	});

	it('reads an unknown feature type as the least precise', () => {
		// Assert
		expect(
			mapSearchResponse({ type: 'FeatureCollection', features: [{ ...FEATURE, properties: { ...FEATURE.properties, type: 'parcel' } }] })[0]
				.precision,
		).toBe('municipality');
	});

	it('keeps the service order', () => {
		// Act
		const second = { ...FEATURE, properties: { ...FEATURE.properties, label: 'second', score: 0.9 } };

		// Assert — the verdict takes the first one, even with a lower score
		expect(mapSearchResponse({ type: 'FeatureCollection', features: [FEATURE, second] }).map((c) => c.label)).toEqual([
			'8 Boulevard du Port 80000 Amiens',
			'second',
		]);
	});

	it('skips a feature without a label or a score', () => {
		// Assert
		expect(
			mapSearchResponse({
				type: 'FeatureCollection',
				features: [{ properties: { score: 1 } }, { properties: { label: 'x' } }, null, FEATURE],
			}),
		).toHaveLength(1);
	});
});

describe('GP-M02 — an answer that is not a FeatureCollection is a technical fault', () => {
	it.each([[null], [{}], [{ type: 'FeatureCollection' }], [{ code: 400, message: 'Failed parsing query' }], ['<html>']])(
		'throws on %j instead of reading "no address"',
		(body) => {
			// Assert
			expect(() => mapSearchResponse(body)).toThrow(TypeError);
		},
	);

	it('reads an empty collection as no candidate', () => {
		// Assert
		expect(mapSearchResponse({ type: 'FeatureCollection', features: [] })).toEqual([]);
	});
});
