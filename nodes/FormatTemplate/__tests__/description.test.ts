/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals -- tests read the sources and fixtures from disk; they are never compiled into the package */
/**
 * Frozen node description (DESC-*)
 *
 * @module FormatTemplate/__tests__/description
 *
 * @description
 * The description is **assembled** from the transform modules
 * (`transforms/<type>/properties.ts`) and the policies (`engine/policies.ts`).
 * This test proves that the assembly returns exactly the expected description:
 * the fixture was captured before the layered restructuring (ADR-0010), before
 * any file was moved.
 *
 * An **intended** change of the interface (English texts, a new transform)
 * updates the fixture in the same commit — its diff then becomes the review of
 * the interface.
 */

import * as fs from 'fs';
import * as path from 'path';

import { FormatTemplate } from '../FormatTemplate.node';

const FIXTURE = path.join(__dirname, 'fixtures', 'description.json');

describe('DESC — node description', () => {
	it('DESC-01: the assembled description matches the fixture, field for field', () => {
		// Arrange
		const expected = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as unknown;

		// Act
		const actual = JSON.parse(JSON.stringify(new FormatTemplate().description)) as unknown;

		// Assert
		expect(actual).toEqual(expected);
	});

	it('DESC-02: the order of the parameters of a row matches the fixture', () => {
		// Arrange — `toEqual` compares arrays in order; this test states it explicitly,
		// because the order is the display order in the editor
		const names = (description: { properties: unknown[] }) =>
			(
				(description.properties[0] as { options: Array<{ values: Array<{ name: string }> }> })
					.options[0].values
			).map((property) => property.name);
		const expected = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as { properties: unknown[] };

		// Act
		const actual = new FormatTemplate().description as unknown as { properties: unknown[] };

		// Assert
		expect(names(actual)).toEqual(names(expected));
	});

	it('DESC-03: a field dragged onto Field Path is written as its path, not as an expression', () => {
		// Arrange — without `requiresDataPath`, the editor writes `{{ $json.address.country }}`
		// on a drop: the expression resolves to the VALUE (`France`), and the node looks for a
		// field of that name. With it, the editor strips `{{ $json.` and `}}` and writes
		// `address.country`.
		const row = (
			new FormatTemplate().description.properties[0] as unknown as {
				options: Array<{ values: Array<{ name: string; requiresDataPath?: string }> }>;
			}
		).options[0].values;

		// Act
		const fieldPath = row.find((property) => property.name === 'fieldPath');

		// Assert
		expect(fieldPath?.requiresDataPath).toBe('single');
	});
});
