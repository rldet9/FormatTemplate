/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals -- tests read the sources and fixtures from disk; they are never compiled into the package */
/**
 * Documentation and publication guards (AR-06, AR-07, AR-08)
 *
 * @module FormatTemplate/__tests__/publication
 *
 * @description
 * The folder is published as is. These tests keep its documentation true to
 * the code and free of anything that only makes sense inside the private
 * repository it comes from:
 *
 * - **AR-06** — every diagnostic code of the node is documented in
 *   `docs/DIAGNOSTICS.md`, and the page documents no code the node lacks;
 * - **AR-07** — every parameter of the node description has a row in
 *   `docs/PARAMETERS.md`, every row names an existing parameter, and every row
 *   cites a test file and test identifiers that exist (ADR-0008);
 * - **AR-08** — no file of the folder carries an internal reference (private
 *   document identifiers, private paths, execution numbers, private network
 *   addresses, links leaving the folder), except the two files declared
 *   private, which are not published.
 *
 * Like the architecture tests, they read files rather than a simulated
 * context, so they also cover files nobody has written yet.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { INodeProperties } from 'n8n-workflow';

import { FormatTemplate } from '../FormatTemplate.node';
import { FT_CODES } from '../kernel/diagnostics';

/** Root of the node folder. */
const ROOT = path.join(__dirname, '..');

/** Reads a file of the folder. */
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf-8');

/**
 * Files of the folder that are **not** published: the private narrative fiche of an
 * internal tool, and the private changelog. They may cite internal material.
 */
const PRIVATE_FILES = new Set(['FormatTemplate.node.md', 'CHANGELOG.md']);

/** This file holds the forbidden patterns themselves. */
const SELF = '__tests__/publication.test.ts';

/**
 * Lists every file of the folder, relative to {@link ROOT}, with `/` separators.
 *
 * @param dir - Absolute directory to walk
 * @returns Relative paths
 */
function walkFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules') continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...walkFiles(full));
		else files.push(path.relative(ROOT, full).split(path.sep).join('/'));
	}
	return files;
}

/**
 * Flattens the parameters of a description into their documented names.
 *
 * @param properties - Parameters of the node description
 * @param prefix - Name of the enclosing `collection`, if any
 * @returns Leaf names: `fieldPath`, `options.traceValues`…
 *
 * @remarks
 * A `fixedCollection` is a container whose rows hold the real parameters; a
 * `collection` groups options that are documented as `<collection>.<option>`.
 */
function leafParameters(properties: readonly INodeProperties[], prefix = ''): string[] {
	const names: string[] = [];
	for (const property of properties) {
		if (property.type === 'fixedCollection') {
			for (const option of (property.options ?? []) as Array<{ values: INodeProperties[] }>) {
				names.push(...leafParameters(option.values, prefix));
			}
		} else if (property.type === 'collection') {
			names.push(...leafParameters(property.options as INodeProperties[], `${property.name}.`));
		} else {
			names.push(`${prefix}${property.name}`);
		}
	}
	return [...new Set(names)];
}

/** One row of the parameter matrix. */
interface MatrixRow {
	parameter: string;
	provenBy: string;
}

/**
 * Reads the rows of `docs/PARAMETERS.md`.
 *
 * @returns Rows whose first cell is a backquoted parameter name
 */
function matrixRows(): MatrixRow[] {
	return read('docs/PARAMETERS.md')
		.split('\n')
		.filter((line) => line.startsWith('| `'))
		.map((line) => {
			const cells = line.split('|').map((cell) => cell.trim());
			return { parameter: cells[1].replace(/`/g, ''), provenBy: cells[cells.length - 2] };
		});
}

describe('AR-06 — diagnostics catalogue', () => {
	const catalogue = read('docs/DIAGNOSTICS.md');
	const known = new Set<string>(Object.values(FT_CODES));

	it('documents every code of the node', () => {
		// Act
		const missing = [...known].filter((code) => !catalogue.includes(`| \`${code}\` |`));

		// Assert
		expect(missing).toEqual([]);
	});

	it('documents no code the node does not have', () => {
		// Act
		const unknown = [...new Set(catalogue.match(/\bFT_[A-Z0-9_]+\b/g) ?? [])].filter(
			(code) => !known.has(code),
		);

		// Assert
		expect(unknown).toEqual([]);
	});
});

describe('AR-07 — parameter matrix (ADR-0008)', () => {
	const rows = matrixRows();
	const parameters = leafParameters(new FormatTemplate().description.properties);

	it('reads the matrix and the description (guard of the test itself)', () => {
		// Assert — an empty reading would make every rule pass
		expect(rows.length).toBeGreaterThanOrEqual(14);
		expect(parameters).toEqual(expect.arrayContaining(['fieldPath', 'options.traceValues']));
	});

	it('has a row for every parameter of the node', () => {
		// Act
		const documented = new Set(rows.map((row) => row.parameter));
		const missing = parameters.filter((name) => !documented.has(name));

		// Assert
		expect(missing).toEqual([]);
	});

	it('has no row for a parameter the node does not have', () => {
		// Act
		const stale = rows.map((row) => row.parameter).filter((name) => !parameters.includes(name));

		// Assert
		expect(stale).toEqual([]);
	});

	it('cites, on every row, test files and test identifiers that exist', () => {
		// Act
		const problems: string[] = [];
		for (const row of rows) {
			const citations = [...row.provenBy.matchAll(/`([\w.-]+\.test\.ts)`(?:\s*\(([^)]*)\))?/g)];
			if (citations.length === 0) problems.push(`${row.parameter}: no test cited`);
			for (const [, file, ids] of citations) {
				const testPath = path.join(ROOT, '__tests__', file);
				if (!fs.existsSync(testPath)) {
					problems.push(`${row.parameter}: ${file} does not exist`);
					continue;
				}
				const source = fs.readFileSync(testPath, 'utf-8');
				for (const id of (ids ?? '').split(',').map((part) => part.trim()).filter(Boolean)) {
					if (!source.includes(id)) problems.push(`${row.parameter}: ${id} not found in ${file}`);
				}
			}
		}

		// Assert
		expect(problems).toEqual([]);
	});
});

describe('AR-08 — the published folder carries no internal reference', () => {
	/** Forbidden patterns, each with the reason it is forbidden. */
	const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
		[/\b(?:SPEC|RECETTE|NOTE|REX|CHANTIER|MEP|PLAN)-[A-Z][A-Z0-9-]*-20\d\d-\d{3}\b/, 'private document identifier'],
		[/\bDEC-FT-\d+/, 'private decision identifier — cite the ADR'],
		[/\banalyse\//, 'private working folder'],
		[/\blots? L\d+\b/, 'private delivery lot'],
		[/\bCUSTOM\.\w/, 'private deployment type prefix'],
		[/\bex[ée]c\w*\.?\s+(?:\w+\s+)?\d{5}\b/i, 'execution number'],
		[/\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/, 'private network address'],
		[/\b(?:m3|mixtrio)-[a-z]/i, 'private repository, tool or instance name'],
		[/\.mixtrio\.(?:fr|net)\b/i, 'private host or address'],
		[/github\.com\/rldet9\/(?!FormatTemplate\b)/, 'link to another, private repository'],
		[/\bnodes\/Eip\b|\b(?:deploy|mep|release|probe)\.js\b/, 'private repository path or tool'],
	];

	const published = walkFiles(ROOT).filter(
		(file) => !PRIVATE_FILES.has(file) && file !== SELF && !/\.(png|jpe?g|gif)$/i.test(file),
	);

	it('scans the folder (guard of the test itself)', () => {
		// Assert
		expect(published.length).toBeGreaterThan(40);
		expect(published).toContain('docs/ARCHITECTURE.md');
		expect(published).not.toContain('FormatTemplate.node.md');
	});

	it('finds none of the forbidden patterns', () => {
		// Act
		const findings: string[] = [];
		for (const file of published) {
			read(file)
				.split('\n')
				.forEach((line, index) => {
					for (const [pattern, reason] of FORBIDDEN) {
						if (pattern.test(line)) findings.push(`${file}:${index + 1} — ${reason}: ${line.trim().slice(0, 100)}`);
					}
				});
		}

		// Assert
		expect(findings).toEqual([]);
	});

	it('has no documentation link leaving the folder', () => {
		// Act
		const escapes: string[] = [];
		for (const file of published.filter((name) => name.endsWith('.md'))) {
			for (const [, target] of read(file).matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
				if (/^[a-z]+:/i.test(target)) continue; // absolute URL
				const resolved = path.relative(ROOT, path.resolve(ROOT, path.dirname(file), target));
				if (resolved.startsWith('..')) escapes.push(`${file} → ${target}`);
				else if (!fs.existsSync(path.join(ROOT, resolved))) escapes.push(`${file} → ${target} (missing)`);
			}
		}

		// Assert — a link to the private repository would be dead once published
		expect(escapes).toEqual([]);
	});
});
