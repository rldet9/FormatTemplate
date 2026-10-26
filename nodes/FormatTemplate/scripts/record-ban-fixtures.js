/**
 * Records the geocoder answers of the postal-address calibration corpus.
 *
 * Reads `__tests__/fixtures/postal-address/corpus.json`, sends each case's `query` to the
 * Géoplateforme geocoding service (Base Adresse Nationale index), and writes the raw
 * answers to `__tests__/fixtures/postal-address/ban-responses.json`. The tests replay
 * those answers offline: they never call the network.
 *
 * Development tool only — neither compiled nor shipped with the node. Re-run it after
 * adding a case or changing how queries are built, then review the diff of the answers:
 * the national base evolves, and a changed answer may change a verdict.
 *
 * Usage: node nodes/FormatTemplate/scripts/record-ban-fixtures.js
 */
const fs = require('fs');
const path = require('path');

const FIXTURES = path.resolve(__dirname, '..', '__tests__', 'fixtures', 'postal-address');
const CORPUS = path.join(FIXTURES, 'corpus.json');
const OUT = path.join(FIXTURES, 'ban-responses.json');

const ENDPOINT = 'https://data.geopf.fr/geocodage/search';
const PARAMETERS = { index: 'address', limit: '5', autocomplete: '0' };
/** Well under the service limit of 50 requests per second and per IP address. */
const DELAY_MS = 150;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
	const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
	const queries = [...new Set(corpus.cases.map((c) => c.query).filter(Boolean))];
	const responses = {};

	for (const query of queries) {
		const url = `${ENDPOINT}?${new URLSearchParams({ q: query, ...PARAMETERS })}`;
		const answer = await fetch(url, { headers: { accept: 'application/json' } });
		if (!answer.ok) throw new Error(`HTTP ${answer.status} for "${query}"`);
		const body = await answer.json();
		responses[query] = { type: body.type, features: body.features };
		console.log(`${String(body.features.length).padStart(2)} candidate(s)  ${query}`);
		await sleep(DELAY_MS);
	}

	const recording = {
		$source:
			'Base Adresse Nationale, through the Géoplateforme geocoding service (IGN) — ' +
			'Licence Ouverte / Open Licence 2.0 (Etalab). Raw answers, recorded for offline tests.',
		endpoint: ENDPOINT,
		parameters: PARAMETERS,
		recordedAt: new Date().toISOString().slice(0, 10),
		responses,
	};
	fs.writeFileSync(OUT, JSON.stringify(recording, null, '\t') + '\n', 'utf8');
	console.log(`written: ${OUT} (${queries.length} queries)`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
