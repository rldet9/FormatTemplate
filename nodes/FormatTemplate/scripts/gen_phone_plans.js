/**
 * Generates nodes/FormatTemplate/transforms/phone/numberingPlans.ts from the phone number
 * metadata of libphonenumber, at a pinned version.
 *
 * Output: a frozen table of the numbering plans of every country, versioned with the node —
 * no runtime dependency, no network call at runtime (ADR-0005, ADR-0016). Also writes the
 * example numbers of the metadata to `__tests__/fixtures/phone/examples.json`: the per-country
 * test corpus.
 *
 * Development tool only: it is neither compiled nor shipped with the node.
 *
 * Usage:
 *   node nodes/FormatTemplate/scripts/gen_phone_plans.js              downloads the pinned file
 *   node nodes/FormatTemplate/scripts/gen_phone_plans.js --xml <path> reads a local copy
 *
 * Either way the file must match the pinned SHA-256. To move to another version, change
 * VERSION and SHA256 together, regenerate, and review the diff of the table: a changed range
 * can change the reading of real numbers.
 */
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

/** Pinned libphonenumber release. */
const VERSION = '9.0.41';
const SHA256 = '9d3b07b53c7e8a437ddc316249620b51d4090987026f9e8ffb9743aab4e4d5a6';
const SOURCE_URL = `https://raw.githubusercontent.com/google/libphonenumber/v${VERSION}/resources/PhoneNumberMetadata.xml`;

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'transforms', 'phone', 'numberingPlans.ts');
const FIXTURE = path.join(ROOT, '__tests__', 'fixtures', 'phone', 'examples.json');

/** Number types of the metadata whose lengths make up the possible lengths of a plan. */
const TYPES = [
	'fixedLine',
	'mobile',
	'pager',
	'tollFree',
	'premiumRate',
	'sharedCost',
	'personalNumber',
	'voip',
	'uan',
	'voicemail',
];

/**
 * The three plans of the first typeVersion 6 release, kept as they were (ADR-0004, ADR-0016).
 *
 * Their reading accepts any digits of the right length and their rendering uses a single
 * grouping, as before: a value already formatted by the node is formatted identically. Only
 * these fields replace the metadata; the national prefix and its parsing rule stay those of
 * the metadata, which are the same as before (`0` in France, `1` in North America).
 */
const HISTORICAL_PLANS = {
	FR: {
		lengths: [9],
		pattern: '\\d{9}',
		formats: [
			{
				pattern: '(\\d)(\\d{2})(\\d{2})(\\d{2})(\\d{2})',
				format: '$1 $2 $3 $4 $5',
				nationalPrefixFormattingRule: '$NP$FG',
			},
		],
	},
	US: {
		lengths: [10],
		pattern: '\\d{10}',
		formats: [{ pattern: '(\\d{3})(\\d{3})(\\d{4})', format: '($1) $2-$3', intlFormat: '$1-$2-$3' }],
	},
	CA: { lengths: [10], pattern: '\\d{10}' },
};

// --- reading the metadata --------------------------------------------------

/**
 * Downloads the pinned metadata file.
 *
 * @returns {Promise<Buffer>} File content
 */
function download() {
	return new Promise((resolve, reject) => {
		https
			.get(SOURCE_URL, (response) => {
				if (response.statusCode !== 200) {
					reject(new Error(`HTTP ${response.statusCode} for ${SOURCE_URL}`));
					response.resume();
					return;
				}
				const chunks = [];
				response.on('data', (chunk) => chunks.push(chunk));
				response.on('end', () => resolve(Buffer.concat(chunks)));
			})
			.on('error', reject);
	});
}

/** Removes the whitespace libphonenumber allows inside its patterns. */
const compact = (text) => text.replace(/\s+/g, '');

/**
 * Reads the attributes of an XML start tag.
 *
 * @param {string} tag - Text between the element name and `>`
 * @returns {Record<string, string>} Attributes
 */
function attributes(tag) {
	const out = {};
	for (const match of tag.matchAll(/([A-Za-z]+)="([^"]*)"/g)) out[match[1]] = match[2];
	return out;
}

/**
 * Expands a `possibleLengths` attribute: `"7,[9-11]"` → `[7, 9, 10, 11]`.
 *
 * @param {string|undefined} spec - Attribute value
 * @returns {number[]} Lengths
 */
function expandLengths(spec) {
	if (!spec) return [];
	const lengths = [];
	for (const part of spec.split(',')) {
		const range = /^\[(\d+)-(\d+)\]$/.exec(part);
		if (range) for (let n = Number(range[1]); n <= Number(range[2]); n++) lengths.push(n);
		else if (/^\d+$/.test(part)) lengths.push(Number(part));
		else throw new Error(`unreadable possibleLengths: ${spec}`);
	}
	return lengths;
}

/**
 * Reads the territories of `PhoneNumberMetadata.xml`.
 *
 * @param {string} xml - File content
 * @returns {object[]} Territories, in file order
 *
 * @remarks
 * A dedicated reader rather than an XML library: the file has a fixed, documented structure
 * (its DTD is at the top of the file) and the generator must stay dependency-free. Every
 * element it relies on is checked; an unexpected shape stops the generation.
 */
function readTerritories(xml) {
	const body = xml.replace(/<!--[\s\S]*?-->/g, '');
	const territories = [];
	for (const match of body.matchAll(/<territory\b([^>]*)>([\s\S]*?)<\/territory>/g)) {
		const attrs = attributes(match[1]);
		const content = match[2];
		const formats = [];
		const available = /<availableFormats>([\s\S]*?)<\/availableFormats>/.exec(content);
		if (available) {
			for (const f of available[1].matchAll(/<numberFormat\b([^>]*)>([\s\S]*?)<\/numberFormat>/g)) {
				const fa = attributes(f[1]);
				const format = /<format>([\s\S]*?)<\/format>/.exec(f[2]);
				if (!fa.pattern || !format) throw new Error(`incomplete numberFormat in ${attrs.id}`);
				const intl = /<intlFormat>([\s\S]*?)<\/intlFormat>/.exec(f[2]);
				formats.push({
					pattern: compact(fa.pattern),
					leadingDigits: [...f[2].matchAll(/<leadingDigits>([\s\S]*?)<\/leadingDigits>/g)].map((l) =>
						compact(l[1]),
					),
					format: format[1].trim(),
					intlFormat: intl ? intl[1].trim() : undefined,
					nationalPrefixFormattingRule: fa.nationalPrefixFormattingRule,
					nationalPrefixOptionalWhenFormatting: fa.nationalPrefixOptionalWhenFormatting === 'true',
				});
			}
		}
		const general = /<generalDesc>\s*<nationalNumberPattern>([\s\S]*?)<\/nationalNumberPattern>/.exec(content);
		if (!general) throw new Error(`no generalDesc in ${attrs.id}`);
		const types = {};
		for (const type of TYPES) {
			const desc = new RegExp(`<${type}>([\\s\\S]*?)</${type}>`).exec(content);
			if (!desc) continue;
			const lengths = /<possibleLengths\b([^>]*)\/>/.exec(desc[1]);
			const example = /<exampleNumber>([\s\S]*?)<\/exampleNumber>/.exec(desc[1]);
			const la = lengths ? attributes(lengths[1]) : {};
			types[type] = {
				national: expandLengths(la.national),
				localOnly: expandLengths(la.localOnly),
				example: example ? example[1].trim() : undefined,
			};
		}
		territories.push({ ...attrs, formats, pattern: compact(general[1]), types });
	}
	return territories;
}

// --- building the plans ------------------------------------------------------

/**
 * Builds the plan of a territory, the way libphonenumber's metadata builder does.
 *
 * @param {object} territory - Territory read from the file
 * @returns {object} Plan, ready to render
 */
function buildPlan(territory) {
	const national = new Set();
	const localOnly = new Set();
	for (const type of TYPES) {
		const desc = territory.types[type];
		if (!desc) continue;
		desc.national.forEach((n) => national.add(n));
		desc.localOnly.forEach((n) => localOnly.add(n));
	}
	// A local-only length is one no type allows nationally (libphonenumber removes the overlap).
	for (const n of national) localOnly.delete(n);

	const prefix = territory.nationalPrefix;
	const plan = {
		callingCode: territory.countryCode,
		lengths: [...national].sort((a, b) => a - b),
		pattern: territory.pattern,
	};
	if (localOnly.size > 0) plan.localLengths = [...localOnly].sort((a, b) => a - b);
	if (prefix) plan.nationalPrefix = prefix;
	const forParsing = territory.nationalPrefixForParsing && compact(territory.nationalPrefixForParsing);
	if (forParsing && forParsing !== prefix) plan.nationalPrefixForParsing = forParsing;
	if (territory.nationalPrefixTransformRule) {
		plan.nationalPrefixTransformRule = compact(territory.nationalPrefixTransformRule);
	}
	const formats = territory.formats.map((f) => buildFormat(f, prefix));
	if (formats.length > 0) plan.formats = formats;
	return plan;
}

/**
 * Builds a format: the national prefix rule is applied once, here, as libphonenumber does.
 *
 * @param {object} f - `numberFormat` read from the file
 * @param {string|undefined} prefix - National prefix of the territory
 * @returns {object} Format
 */
function buildFormat(f, prefix) {
	const rule = f.nationalPrefixFormattingRule;
	// `$NP` is the national prefix, `$FG` the first group; the rule replaces the first group
	// reference of the format (`$1 $2 $3` with `$NP$FG` → `0$1 $2 $3`).
	const national = rule
		? f.format.replace(/(\$\d)/, rule.replace('$NP', prefix ?? '').replace('$FG', '$1'))
		: f.format;
	const format = { pattern: f.pattern };
	// libphonenumber matches the most detailed leading-digits pattern: the last one.
	if (f.leadingDigits.length > 0) format.leadingDigits = f.leadingDigits[f.leadingDigits.length - 1];
	format.format = f.format;
	if (national !== f.format) format.national = national;
	if (f.intlFormat === 'NA') format.international = null;
	else if (f.intlFormat !== undefined && f.intlFormat !== f.format) format.international = f.intlFormat;
	if (rule && rule.includes('$NP') && prefix && !f.nationalPrefixOptionalWhenFormatting) {
		format.prefixRequired = true;
	}
	return format;
}

// --- checks ----------------------------------------------------------------

/**
 * Stops the generation on any shape the engine does not handle.
 *
 * @param {Record<string, object>} plans - Plans by ISO2
 * @param {Record<string, string[]>} callingCodes - Territories by calling code, main first
 */
function check(plans, callingCodes) {
	const compile = (source, where) => {
		try {
			return new RegExp(`^(?:${source})$`);
		} catch (error) {
			throw new Error(`${where}: pattern not valid in JavaScript: ${error.message}`);
		}
	};
	for (const [id, plan] of Object.entries(plans)) {
		if (!/^[A-Z]{2}$/.test(id)) throw new Error(`unexpected territory id ${id}`);
		if (plan.lengths.length === 0) throw new Error(`${id}: no possible length`);
		compile(plan.pattern, id);
		if (plan.nationalPrefixForParsing) compile(plan.nationalPrefixForParsing, `${id} prefix`);
		for (const f of plan.formats ?? []) {
			compile(f.pattern, `${id} format`);
			if (f.leadingDigits) compile(f.leadingDigits, `${id} leading digits`);
		}
	}
	// Calling codes form a prefix code: reading an international input takes the only one
	// that prefixes the digits.
	const codes = Object.keys(callingCodes);
	for (const a of codes) {
		for (const b of codes) {
			if (a !== b && b.startsWith(a)) throw new Error(`calling code ${a} prefixes ${b}`);
		}
	}
	// A shared calling code is rendered with its main territory's formats and national prefix:
	// a territory with another prefix would be rendered wrongly.
	for (const [code, ids] of Object.entries(callingCodes)) {
		const main = plans[ids[0]];
		for (const id of ids.slice(1)) {
			if (plans[id].formats) throw new Error(`${id} (+${code}) has its own formats`);
			const prefix = plans[id].nationalPrefix;
			if (prefix && prefix !== main.nationalPrefix) {
				throw new Error(`${id} national prefix ${prefix} differs from ${ids[0]}`);
			}
		}
	}
}

// --- rendering -------------------------------------------------------------

/** Single-quoted TypeScript string literal. */
const str = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Object key, quoted only when it must be. */
const key = (name) => (/^[A-Za-z_]\w*$/.test(name) ? name : str(name));

/**
 * Renders a value as TypeScript: one property per line, except the objects of an array,
 * written one per line — a format, an option. That keeps the table readable line by line
 * and about a tenth smaller.
 *
 * @param {unknown} value - Value to render
 * @param {string} indent - Current indentation
 * @param {boolean} [inline] - Render on a single line
 * @returns {string} TypeScript expression
 */
function render(value, indent, inline = false) {
	const inner = `${indent}\t`;
	if (value === null) return 'null';
	if (typeof value === 'string') return str(value);
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (Array.isArray(value)) {
		if (value.every((v) => typeof v === 'number')) return `[${value.join(', ')}]`;
		return `[\n${value.map((v) => `${inner}${render(v, inner, true)},`).join('\n')}\n${indent}]`;
	}
	const entries = Object.entries(value).map(([name, v]) => `${key(name)}: ${render(v, inner, inline)}`);
	if (inline) return `{ ${entries.join(', ')} }`;
	return `{\n${entries.map((entry) => `${inner}${entry},`).join('\n')}\n${indent}}`;
}

// --- main ------------------------------------------------------------------

async function main() {
	const xmlIndex = process.argv.indexOf('--xml');
	const raw = xmlIndex > 0 ? fs.readFileSync(process.argv[xmlIndex + 1]) : await download();
	const digest = crypto.createHash('sha256').update(raw).digest('hex');
	if (digest !== SHA256) {
		throw new Error(`SHA-256 mismatch for libphonenumber ${VERSION}: ${digest}, expected ${SHA256}`);
	}
	const xml = raw.toString('utf8');
	const copyright = /Copyright \(C\) 2009 The Libphonenumber Authors/.exec(xml);
	const license = /Licensed under the Apache License, Version 2\.0/.exec(xml);
	if (!copyright || !license) throw new Error('copyright or license notice not found in the file');

	// Non-geographic entities (`001`: +800, +808, +870…) are services, not countries: left out.
	const territories = readTerritories(xml).filter((t) => t.id !== '001');
	if (territories.length < 240) throw new Error(`only ${territories.length} territories read`);

	const plans = {};
	for (const territory of territories) {
		const plan = buildPlan(territory);
		const historical = HISTORICAL_PLANS[territory.id];
		if (historical) {
			plan.lengths = historical.lengths;
			plan.pattern = historical.pattern;
			delete plan.localLengths;
			if (historical.formats) plan.formats = historical.formats.map((f) => buildFormat({ leadingDigits: [], ...f }, plan.nationalPrefix));
		}
		plans[territory.id] = plan;
	}

	const callingCodes = {};
	for (const territory of territories) (callingCodes[territory.countryCode] ||= []).push(territory.id);
	for (const [code, ids] of Object.entries(callingCodes)) {
		if (ids.length === 1) continue;
		const main = territories.find((t) => t.countryCode === code && t.mainCountryForCode === 'true');
		if (!main) throw new Error(`no main territory for shared calling code ${code}`);
		callingCodes[code] = [main.id, ...ids.filter((id) => id !== main.id)];
	}
	check(plans, callingCodes);

	const names = new Intl.DisplayNames(['en'], { type: 'region' });
	const options = Object.entries(plans)
		.map(([id, plan]) => ({ name: `${names.of(id)} (+${plan.callingCode})`, value: id }))
		.sort((a, b) => a.name.localeCompare(b.name));
	const unnamed = options.filter((o) => o.name.startsWith(`${o.value} `));
	if (unnamed.length > 0) throw new Error(`no English name for ${unnamed.map((o) => o.value).join(', ')}`);

	const sortedCodes = Object.keys(callingCodes).sort((a, b) => Number(a) - Number(b));
	const today = process.env.GEN_DATE || '2026-10-26';
	const formatCount = Object.values(plans).reduce((n, p) => n + (p.formats?.length ?? 0), 0);

	const content = `/**
 * Numbering plans of every country — the data read by the \`phone\` transformation.
 *
 * GENERATED on ${today} by \`scripts/gen_phone_plans.js\` from \`PhoneNumberMetadata.xml\` of
 * libphonenumber v${VERSION} (SHA-256 ${SHA256.slice(0, 16)}…). DO NOT EDIT BY HAND: regenerate.
 *
 * Data derived from libphonenumber — Copyright (C) 2009 The Libphonenumber Authors — licensed
 * under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0). This file
 * is a modified form of that data: comments, examples and per-type patterns are dropped, the
 * national prefix rules are applied to the formats, the non-geographic entities are left out,
 * and the plans of FR, US and CA keep the reading and the grouping of the node's first
 * typeVersion 6 release (ADR-0016). Not an official libphonenumber artifact.
 *
 * Why an embedded table (ADR-0016): the node has no runtime dependency (ADR-0005) and never
 * calls the network to read a phone number. Regenerating it is a deliberate, reviewable change.
 *
 * ${Object.keys(plans).length} territories, ${sortedCodes.length} calling codes, ${formatCount} formats.
 */
/* eslint-disable n8n-nodes-base/node-param-display-name-miscased -- the option names are country names from ICU, proper nouns: title case would misspell "Tristan da Cunha" */

import type { NumberingPlan } from './planTypes';

/** Origin of the data, kept at runtime: the compiled package carries no comment. */
export const PHONE_METADATA = {
	source: 'libphonenumber',
	version: ${str(VERSION)},
	sha256: ${str(SHA256)},
	copyright: 'Copyright (C) 2009 The Libphonenumber Authors',
	license: 'Apache-2.0',
} as const;

/** Territories by calling code; for a shared code, the main territory comes first. */
export const CALLING_CODES: Readonly<Record<string, readonly string[]>> = {
${sortedCodes.map((code) => `\t${str(code)}: [${callingCodes[code].map(str).join(', ')}],`).join('\n')}
};

/** Numbering plans, by ISO 3166-1 alpha-2 code. */
export const NUMBERING_PLANS: Readonly<Record<string, NumberingPlan>> = ${render(plans, '')};

/** Options of the \`defaultCountry\` parameter: English name and calling code, sorted by name. */
export const PHONE_COUNTRY_OPTIONS: ReadonlyArray<{ name: string; value: string }> = ${render(options, '')};
`;
	fs.writeFileSync(OUT, content, 'utf8');

	const examples = {};
	for (const territory of territories) {
		const byType = {};
		for (const type of TYPES) {
			const example = territory.types[type]?.example;
			if (example) byType[type] = example;
		}
		examples[territory.id] = { callingCode: territory.countryCode, examples: byType };
	}
	const fixture = {
		$source:
			`Example numbers of libphonenumber v${VERSION} — Copyright (C) 2009 The Libphonenumber Authors, ` +
			'Apache License 2.0. The exampleNumber of each number type, published to illustrate the plan.',
		version: VERSION,
		territories: examples,
	};
	fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
	fs.writeFileSync(FIXTURE, JSON.stringify(fixture, null, '\t') + '\n', 'utf8');

	console.log('written:', OUT, `(${fs.statSync(OUT).size} bytes)`);
	console.log('written:', FIXTURE);
	console.log('territories   :', Object.keys(plans).length);
	console.log('calling codes :', sortedCodes.length);
	console.log('formats       :', formatCount);
	console.log('historical    :', Object.keys(HISTORICAL_PLANS).join(', '));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
