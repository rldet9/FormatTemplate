/**
 * Generates nodes/FormatTemplate/transforms/country/countryCodes.ts from the ICU data
 * embedded in Node (Intl.DisplayNames, locales en + fr).
 *
 * Output: a frozen table, versioned with the node — no network dependency (ADR-0009).
 * Development tool only: it is neither compiled nor shipped with the node.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'transforms', 'country', 'countryCodes.ts');

// --- normalization: must stay STRICTLY identical to the transform's own
const normalize = (v) =>
	String(v)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

// --- enumeration of every two-letter region code ICU knows
const en = new Intl.DisplayNames(['en'], { type: 'region' });
const fr = new Intl.DisplayNames(['fr'], { type: 'region' });
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ICU regions that are not countries: they must never come out of the transform.
const NON_COUNTRY = new Set(['EU', 'EZ', 'QO', 'UN', 'XA', 'XB', 'ZZ']);

const codes = []; // ISO2 codes in force
const legacy = []; // obsolete codes: [code, canonicalCode]
for (const a of A) {
	for (const b of A) {
		const code = a + b;
		let nameEn;
		try {
			nameEn = en.of(code);
		} catch (e) {
			continue;
		}
		// ICU returns the code itself when the region is unknown
		if (!nameEn || nameEn === code) continue;
		if (NON_COUNTRY.has(code)) continue;

		// An obsolete code (DD, SU, YU, UK, ZR…) canonicalizes to ANOTHER code: it must
		// not enter the table as a target, otherwise "France" (FR/FX), "Germany" (DE/DD)
		// or "Russia" (RU/SU) become ambiguous and get dropped.
		const canon = Intl.getCanonicalLocales('und-' + code)[0].slice(4);
		if (canon !== code) {
			legacy.push([code, canon]);
			continue;
		}
		codes.push(code);
	}
}

// --- building the normalized name -> ISO2 table, collisions dropped
const map = new Map();
const collisions = new Map();
const add = (name, code, source) => {
	const key = normalize(name);
	if (!key) return;
	const prev = map.get(key);
	if (prev && prev.code !== code) {
		if (source === 'legacy') return; // a historical name never wins
		if (!collisions.has(key)) collisions.set(key, new Set([prev.code]));
		collisions.get(key).add(code);
		return;
	}
	if (!prev) map.set(key, { code, source });
};

for (const code of codes) {
	add(en.of(code), code, 'en');
	add(fr.of(code), code, 'fr');
}

// Ambiguous keys are removed: an explicit error is better than a wrong country.
for (const key of collisions.keys()) map.delete(key);

// Historical names (Zaire -> CD, Burma -> MM, USSR -> RU…): added only on keys
// still free, after the names in force.
const legacyKept = [];
for (const [code, canon] of legacy) {
	if (!codes.includes(canon)) continue;
	for (const name of [en.of(code), fr.of(code)]) {
		const key = normalize(name);
		if (!key || map.has(key)) continue;
		map.set(key, { code: canon, source: 'legacy' });
		legacyKept.push(key + ' -> ' + canon);
	}
}

// --- common aliases (human or ERP input) that ICU does not list
const ALIASES = {
	usa: 'US',
	'u s a': 'US',
	'united states of america': 'US',
	'etats unis d amerique': 'US',
	amerique: 'US',
	uk: 'GB',
	'u k': 'GB',
	'great britain': 'GB',
	'grande bretagne': 'GB',
	england: 'GB',
	angleterre: 'GB',
	ecosse: 'GB',
	scotland: 'GB',
	'pays de galles': 'GB',
	wales: 'GB',
	holland: 'NL',
	hollande: 'NL',
	'czech republic': 'CZ',
	'republique tcheque': 'CZ',
	uae: 'AE',
	'ivory coast': 'CI',
	burma: 'MM',
	birmanie: 'MM',
	'viet nam': 'VN',
	'cap vert': 'CV',
	'cape verde': 'CV',
	'south korea': 'KR',
	'coree du sud': 'KR',
	'north korea': 'KP',
	'coree du nord': 'KP',
	eire: 'IE',
	deutschland: 'DE',
	espana: 'ES',
	italia: 'IT',
	suisse: 'CH',
	schweiz: 'CH',
	belgique: 'BE',
	belgie: 'BE',
	luxemburg: 'LU',
};
const aliasEntries = [];
for (const [k, code] of Object.entries(ALIASES)) {
	const key = normalize(k);
	if (!codes.includes(code)) throw new Error('alias to an unknown code: ' + code);
	if (map.has(key)) {
		if (map.get(key).code !== code) throw new Error('alias conflicting with ICU: ' + key);
		continue; // already covered by ICU
	}
	map.set(key, { code, source: 'alias' });
	aliasEntries.push(key);
}

// --- rendering the TypeScript file
const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const lines = sorted.map(([k, v]) => `\t'${k.replace(/'/g, "\\'")}': '${v.code}',`);
const today = process.env.GEN_DATE || '2026-08-10';

const content = `/**
 * Embedded ISO 3166-1 alpha-2 table.
 *
 * GENERATED on ${today} by \`scripts/gen_country_table.js\` from the ICU data of
 * Node (\`Intl.DisplayNames\`, locales \`en\` and \`fr\`), completed with common aliases.
 * DO NOT EDIT BY HAND: regenerate.
 *
 * Why a frozen table rather than an API call (ADR-0009): converting a name to ISO2
 * relies on a standard that almost never moves, while a network dependency adds a
 * latency per item, a single point of failure and an external breaking surface.
 * The public restcountries.com v3.1 service, used until 2026-08-10, was deprecated
 * without notice (301 to a \`{success:false}\` payload): every conversion of a full
 * name failed, "France" included.
 *
 * ${sorted.length} entries for ${codes.length} ISO2 codes in force, including ${aliasEntries.length} common aliases.
 * Obsolete codes (DD, SU, YU, UK, ZR…) are left out: ICU already displays them under
 * the name of the current country, so "Zaire" or "USSR" are not resolved — on purpose.
 * Keys dropped for ambiguity between locales: ${[...collisions.keys()].map((k) => `"${k}"`).join(', ') || 'none'}.
 */

/** Recognized ISO 3166-1 alpha-2 codes. */
export const ISO2_CODES: ReadonlySet<string> = new Set([
${codes.map((c) => `\t'${c}',`).join('\n')}
]);

/**
 * Normalized country name -> ISO2 code.
 * Keys have already gone through \`normalizeCountryKey\`: only compare normalized text.
 */
export const COUNTRY_NAME_TO_ISO2: Readonly<Record<string, string>> = {
${lines.join('\n')}
};

/**
 * Normalizes an input for comparison: no accents, no case, no punctuation,
 * normalized spaces. "Côte d'Ivoire" and "COTE D IVOIRE" -> "cote d ivoire".
 */
export function normalizeCountryKey(value: string): string {
	return String(value)
		.normalize('NFD')
		.replace(/[\\u0300-\\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}
`;

fs.writeFileSync(OUT, content, 'utf8');
console.log('written:', OUT);
console.log('ISO2 codes        :', codes.length);
console.log('table entries     :', sorted.length);
console.log('aliases added     :', aliasEntries.length);
console.log('collisions dropped:', [...collisions.entries()].map(([k, v]) => k + ' -> ' + [...v].join('/')).join(' | ') || 'none');
