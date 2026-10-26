/**
 * Vocabulary of French postal addresses
 *
 * @version 1.0.0
 * @module FormatTemplate/transforms/postalAddress/vocabulary
 *
 * @description
 * Two kinds of tables, kept apart on purpose (ADR-0014):
 *
 * - **what the node writes** — {@link OFFICIAL_ABBREVIATIONS}, the twenty
 *   street-type abbreviations the French address standard authorizes (list
 *   published in La Poste guide SP8855, volume 2, §3.3). The node never writes
 *   any other abbreviation;
 * - **what the node reads** — street-type aliases, title abbreviations, stop
 *   words, complement and distribution keywords. They describe how people
 *   actually type addresses (`bd`, `av.`, `fbg`, `st`), and are only used to
 *   understand an input and compare it with an answer.
 *
 * Every entry is in **postal form** (uppercase, no accent, no punctuation).
 *
 * Pure module — no import of `n8n-workflow`.
 */

/**
 * Street-type abbreviations authorized by the standard: full postal form →
 * abbreviation.
 *
 * @remarks
 * Applied only when line 4 exceeds 38 characters, and only to the street type
 * (ADR-0014). `IMMEUBLE` and `IMMEUBLES` share one entry of the published list.
 */
export const OFFICIAL_ABBREVIATIONS: Readonly<Record<string, string>> = {
	ALLEE: 'ALL',
	AVENUE: 'AV',
	BOULEVARD: 'BD',
	CENTRE: 'CTRE',
	'CENTRE COMMERCIAL': 'CCAL',
	IMMEUBLE: 'IMM',
	IMMEUBLES: 'IMM',
	IMPASSE: 'IMP',
	'LIEU DIT': 'LD',
	LOTISSEMENT: 'LOT',
	PASSAGE: 'PAS',
	PLACE: 'PL',
	RESIDENCE: 'RES',
	'ROND POINT': 'RPT',
	ROUTE: 'RTE',
	SQUARE: 'SQ',
	VILLAGE: 'VLGE',
	'ZONE D ACTIVITE': 'ZA',
	'ZONE D AMENAGEMENT CONCERTE': 'ZAC',
	'ZONE D AMENAGEMENT DIFFERE': 'ZAD',
	'ZONE INDUSTRIELLE': 'ZI',
};

/**
 * Street types: canonical postal form → the forms found in inputs.
 *
 * @remarks
 * Only the **leading** words of a street are read as its type, so a short
 * alias such as `R` (rue) or `CH` (chemin) cannot be mistaken for a word of
 * the name.
 */
export const STREET_TYPES: Readonly<Record<string, readonly string[]>> = {
	ALLEE: ['ALL', 'AL', 'ALLEES'],
	AVENUE: ['AV', 'AVE', 'AVN', 'AVEN'],
	BOULEVARD: ['BD', 'BLD', 'BLVD', 'BOUL', 'BVD', 'BV'],
	CARREFOUR: ['CAR', 'CARR', 'CRF'],
	'CENTRE COMMERCIAL': ['CCAL', 'CC'],
	CHAUSSEE: ['CHS', 'CHAUS'],
	CHEMIN: ['CHE', 'CHEM', 'CH', 'CHMN'],
	CITE: ['CTE'],
	COURS: ['CRS'],
	DOMAINE: ['DOM', 'DOMA'],
	ESPLANADE: ['ESP', 'ESPL'],
	FAUBOURG: ['FBG', 'FG', 'FAUB'],
	HAMEAU: ['HAM', 'HAMO'],
	IMPASSE: ['IMP'],
	'LIEU DIT': ['LD', 'LIEUDIT'],
	LOTISSEMENT: ['LOT', 'LOTIS'],
	MONTEE: ['MTE'],
	PARVIS: ['PRV'],
	PASSAGE: ['PAS', 'PASS', 'PSG'],
	PLACE: ['PL', 'PLA'],
	PLACETTE: ['PLT'],
	PROMENADE: ['PROM', 'PRM'],
	QUAI: ['QU', 'QAI'],
	QUARTIER: ['QUA', 'QRT'],
	RESIDENCE: ['RES', 'RESID'],
	'ROND POINT': ['RPT', 'RDPT'],
	ROUTE: ['RTE', 'RT'],
	RUE: ['R'],
	RUELLE: ['RLE'],
	SENTIER: ['SENT', 'SEN'],
	SQUARE: ['SQ'],
	TRAVERSE: ['TRA', 'TRAV'],
	VILLA: ['VLA'],
	VILLAGE: ['VLGE', 'VGE'],
	VOIE: [],
	'ZONE D ACTIVITE': ['ZA', 'ZONE ACTIVITE', 'ZONE D ACTIVITES'],
	'ZONE D AMENAGEMENT CONCERTE': ['ZAC'],
	'ZONE D AMENAGEMENT DIFFERE': ['ZAD'],
	'ZONE INDUSTRIELLE': ['ZI'],
};

/**
 * Abbreviated words of street names: abbreviation → full word.
 *
 * @remarks
 * Applied to **both** sides of a comparison, so a collision can only make two
 * texts look closer, never apart. Ambiguous abbreviations are left out on
 * purpose: `PRES` (président or prés), `MAR` (maréchal or mars).
 */
export const WORD_ALIASES: Readonly<Record<string, string>> = {
	ST: 'SAINT',
	STE: 'SAINTE',
	GAL: 'GENERAL',
	GEN: 'GENERAL',
	MAL: 'MARECHAL',
	PDT: 'PRESIDENT',
	DR: 'DOCTEUR',
	PR: 'PROFESSEUR',
	PROF: 'PROFESSEUR',
	CDT: 'COMMANDANT',
	CMDT: 'COMMANDANT',
	CNE: 'CAPITAINE',
	LT: 'LIEUTENANT',
	COL: 'COLONEL',
	MGR: 'MONSEIGNEUR',
	ND: 'NOTRE DAME',
};

/** Words that carry no meaning when two street or city names are compared. */
export const STOP_WORDS: ReadonlySet<string> = new Set([
	'DE',
	'DU',
	'DES',
	'LA',
	'LE',
	'LES',
	'L',
	'D',
	'ET',
	'A',
	'AU',
	'AUX',
	'EN',
]);

/**
 * Repetition indices of a house number, normalized: `B` and `BIS` are the same
 * index.
 */
export const REPETITION_INDICES: Readonly<Record<string, string>> = {
	BIS: 'BIS',
	B: 'BIS',
	TER: 'TER',
	T: 'TER',
	QUATER: 'QUATER',
	Q: 'QUATER',
	QUINQUIES: 'QUINQUIES',
	C: 'QUINQUIES',
};

/**
 * Keywords of line 2 — everything **inside** the building: flat, floor,
 * staircase, letterbox, care of.
 */
export const LINE2_KEYWORDS: ReadonlySet<string> = new Set([
	'APPARTEMENT',
	'APPART',
	'APPT',
	'APP',
	'APT',
	'LOGEMENT',
	'LGT',
	'ETAGE',
	'ETG',
	'ESCALIER',
	'ESC',
	'COULOIR',
	'BAL',
	'PORTE',
	'CHEZ',
]);

/**
 * Keywords of line 3 — everything **outside** the building: entrance,
 * building, tower, residence, business zone.
 */
export const LINE3_KEYWORDS: ReadonlySet<string> = new Set([
	'BATIMENT',
	'BAT',
	'BT',
	'BLOC',
	'ENTREE',
	'ENT',
	'IMMEUBLE',
	'IMM',
	'TOUR',
	'RESIDENCE',
	'RES',
	'PAVILLON',
	'ZI',
	'ZA',
	'ZAC',
	'ZAD',
	'ZONE',
]);

/**
 * Keywords that may close a street line inside a single-line input
 * (`10 rue de la Paix appt 12`). Deliberately narrower than the line 2 and 3
 * sets: `PORTE`, `TOUR` or `RESIDENCE` are also words of street names.
 */
export const INLINE_COMPLEMENT_KEYWORDS: ReadonlySet<string> = new Set([
	'APPARTEMENT',
	'APPART',
	'APPT',
	'APT',
	'ETG',
	'ESCALIER',
	'ESC',
	'BAL',
	'BATIMENT',
	'BAT',
]);

/**
 * Special distribution mentions: a postal service that is not a geographical
 * address (post-office box, CEDEX, mail sorting codes).
 */
export const DISTRIBUTION_KEYWORDS: ReadonlySet<string> = new Set(['BP', 'CS', 'TSA', 'CEDEX']);

/** Multi-word special distribution mentions, in postal form. */
export const DISTRIBUTION_PHRASES: readonly string[] = ['BOITE POSTALE', 'POSTE RESTANTE'];

/**
 * ISO 3166-1 codes of the territories the Base Adresse Nationale covers:
 * metropolitan France, the five overseas departments, and three overseas
 * collectivities.
 */
export const SUPPORTED_COUNTRIES: ReadonlySet<string> = new Set([
	'FR',
	'GP',
	'MQ',
	'GF',
	'RE',
	'YT',
	'PM',
	'BL',
	'MF',
]);
