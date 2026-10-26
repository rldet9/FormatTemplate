/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals -- tests read the sources and fixtures from disk; they are never compiled into the package */
/**
 * Access to the recorded postal-address corpus
 *
 * @module FormatTemplate/__tests__/helpers/postalCorpus
 *
 * @description
 * The corpus (`fixtures/postal-address/corpus.json`) lists real inputs with the
 * verdict a careful human gives; the recording (`ban-responses.json`) holds the
 * raw answers of the Géoplateforme geocoding service to their queries, taken
 * once by `scripts/record-ban-fixtures.js`. Tests replay them offline.
 */

import * as fs from 'fs';
import * as path from 'path';

import { mapSearchResponse } from '../../adapters/geoplateforme/mapResponse';
import type { AddressCandidate } from '../../ports/geocoder';
import type { AddressVerdict } from '../../transforms/postalAddress/decide';
import { parseAddressInput, type ParsedAddress } from '../../transforms/postalAddress/parseInput';

const DIRECTORY = path.join(__dirname, '..', 'fixtures', 'postal-address');

/** A corpus case, as stored. */
export interface CorpusCase {
	id: string;
	input: unknown;
	/** A verdict, `rejected`, or `parse:<CODE>`. */
	expected: string;
	note?: string;
	query?: string;
}

/** The recording, as stored. */
export interface Recording {
	$source: string;
	endpoint: string;
	parameters: Record<string, string>;
	recordedAt: string;
	responses: Record<string, unknown>;
}

/** A case that reaches the geocoder, ready to judge. */
export interface GeocodedCase {
	id: string;
	expected: string;
	address: ParsedAddress;
	candidates: AddressCandidate[];
}

/** Verdicts that write a value back. */
export const ACCEPTED: ReadonlySet<AddressVerdict> = new Set(['verified', 'corrected']);

/** Reads the corpus. */
export function loadCorpus(): CorpusCase[] {
	return (JSON.parse(fs.readFileSync(path.join(DIRECTORY, 'corpus.json'), 'utf-8')) as { cases: CorpusCase[] })
		.cases;
}

/** Reads the recording. */
export function loadRecording(): Recording {
	return JSON.parse(fs.readFileSync(path.join(DIRECTORY, 'ban-responses.json'), 'utf-8')) as Recording;
}

/**
 * Parses every case that reaches the geocoder and maps its recorded answer.
 *
 * @returns The geocoded cases
 */
export function geocodedCases(): GeocodedCase[] {
	const recording = loadRecording();
	return loadCorpus().flatMap((corpusCase) => {
		const parsed = parseAddressInput(corpusCase.input);
		if (!parsed.ok) return [];
		return [
			{
				id: corpusCase.id,
				expected: corpusCase.expected,
				address: parsed.address,
				candidates: mapSearchResponse(recording.responses[parsed.address.query]),
			},
		];
	});
}

/**
 * Tells whether a verdict meets an expectation of the corpus.
 *
 * @param expected - `verified`, `corrected`, `imprecise`, `mismatch`, `ambiguous`,
 *                   `not_found`, or `rejected` (any of the last four)
 * @param verdict - Verdict of the transformation
 * @returns `true` if the verdict meets the expectation
 */
export function meets(expected: string, verdict: AddressVerdict): boolean {
	return expected === 'rejected' ? !ACCEPTED.has(verdict) : verdict === expected;
}
