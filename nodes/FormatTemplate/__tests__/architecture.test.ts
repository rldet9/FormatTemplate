/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals -- tests read the sources and fixtures from disk; they are never compiled into the package */
/**
 * Architecture tests of the `formatTemplate` node (AR-*)
 *
 * @module FormatTemplate/__tests__/architecture
 *
 * @description
 * The layering rules of the folder (ADR-0010) are **executable**: they read the
 * sources, not a simulated context, so they also cover modules nobody has
 * written yet.
 *
 * This file holds AR-01 → AR-06 and AR-10: pure layers, network access, folder
 * boundary, zero runtime dependencies, offline `country` transform, registered
 * transform modules, direction of the dependencies between layers. The
 * documentation rules live in `publication.test.ts`: AR-06 for the diagnostics
 * catalogue, AR-07 for the parameter matrix, AR-08 for the publication guard.
 * CO-04 (`country-resolve.test.ts`) keeps the country slice offline; AR-02 is
 * its general form, now that the node has a network adapter.
 */

import * as fs from 'fs';
import * as path from 'path';

import { FT_CODES } from '../kernel/diagnostics';
import { TRANSFORM_MODULES } from '../transforms';

/** Root of the node folder. */
const ROOT = path.join(__dirname, '..');

/** A source of the folder: path relative to the root (`/` separator) and text without comments. */
interface Source {
	file: string;
	code: string;
}

/**
 * Strips the comments of a TypeScript or JavaScript source.
 *
 * @param text - Raw source
 * @returns Source without block or line comments
 *
 * @remarks
 * A `//` preceded by `:` is kept: it is a URL inside a string.
 */
function stripComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
}

/**
 * Lists the `.ts` and `.js` sources under a folder.
 *
 * @param dir - Absolute folder path
 * @returns Sources, with paths relative to {@link ROOT}
 */
function walk(dir: string): Source[] {
	const sources: Source[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name !== 'node_modules' && entry.name !== 'fixtures') sources.push(...walk(full));
			continue;
		}
		if (!/\.(ts|js)$/.test(entry.name)) continue;
		sources.push({
			file: path.relative(ROOT, full).split(path.sep).join('/'),
			code: stripComments(fs.readFileSync(full, 'utf-8')),
		});
	}
	return sources;
}

/** An import found in a source. */
interface ImportRef {
	specifier: string;
	/** `false` for `import type` / `export type`, erased at compile time. */
	runtime: boolean;
}

/**
 * Collects the imports of a source: `import … from`, `export … from`,
 * side-effect import (`import 'x'`), `require()` and dynamic `import()`.
 *
 * @param code - Source without comments
 * @returns Imports found
 */
function importsOf(code: string): ImportRef[] {
	const refs: ImportRef[] = [];
	const fromPattern = /\b(import|export)\s+([^;]*?)\s*from\s*['"]([^'"]+)['"]/g;
	for (const match of code.matchAll(fromPattern)) {
		const clause = match[2].trim();
		const braces = /^\{([\s\S]*)\}$/.exec(clause);
		const allTypeSpecifiers =
			braces !== null &&
			braces[1]
				.split(',')
				.map((specifier) => specifier.trim())
				.filter((specifier) => specifier !== '')
				.every((specifier) => specifier.startsWith('type '));
		refs.push({ specifier: match[3], runtime: !clause.startsWith('type ') && !allTypeSpecifiers });
	}
	for (const pattern of [
		/(?:^|[;\s])import\s+['"]([^'"]+)['"]/g,
		/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
		/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
	]) {
		for (const match of code.matchAll(pattern)) refs.push({ specifier: match[1], runtime: true });
	}
	return refs;
}

const ALL = walk(ROOT);
/** Shipped code: what tsc compiles into `dist/` — neither the tests nor the generation scripts. */
const SHIPPED = ALL.filter(
	(source) => !source.file.startsWith('__tests__/') && !source.file.startsWith('scripts/'),
);
/** Pure layers: no dependency on the n8n runtime. */
const PURE_LAYERS = ['kernel/', 'engine/', 'ports/', 'transforms/', 'v5/legacyTransforms.ts'];
/** The only place allowed to open a connection (ADR-0015). */
const NETWORK_ADAPTERS = ['adapters/n8n/'];
/** The only package shipped code may import: zero runtime dependencies. */
const SHIPPED_PACKAGES = new Set(['n8n-workflow']);

const inLayer = (file: string, prefixes: string[]) =>
	prefixes.some((prefix) => file === prefix || file.startsWith(prefix));

describe('AR — folder architecture', () => {
	it('actually reads the sources (guard of the test itself)', () => {
		// Assert — an empty scan would make every rule pass
		expect(SHIPPED.length).toBeGreaterThan(15);
		expect(SHIPPED.map((s) => s.file)).toContain('engine/processItem.ts');
		expect(importsOf("import type { A } from 'n8n-workflow';")).toEqual([
			{ specifier: 'n8n-workflow', runtime: false },
		]);
		expect(importsOf("import { type A, B } from 'n8n-workflow';")[0].runtime).toBe(true);
		expect(importsOf("import { type A, type B } from 'x';")[0].runtime).toBe(false);
	});

	it('AR-01: pure layers do not import n8n-workflow at runtime', () => {
		// Act
		const offenders = SHIPPED.filter((source) => inLayer(source.file, PURE_LAYERS)).filter(
			(source) =>
				importsOf(source.code).some((ref) => ref.runtime && ref.specifier === 'n8n-workflow'),
		);

		// Assert — `import type` is allowed: it is erased at compile time
		expect(offenders.map((s) => s.file)).toEqual([]);
	});

	it('AR-02: only a network adapter opens a connection', () => {
		// Act
		const network = /\b(fetch|axios|https?\.request|helpers\.(?:http)?[rR]equest\w*)\b/;
		const offenders = SHIPPED.filter(
			(source) => !inLayer(source.file, NETWORK_ADAPTERS) && network.test(source.code),
		);

		// Assert
		expect(offenders.map((s) => s.file)).toEqual([]);
	});

	it('AR-03: no import leaves the folder, tests included', () => {
		// Act
		const escapes = ALL.flatMap((source) =>
			importsOf(source.code)
				.filter((ref) => ref.specifier.startsWith('.'))
				.filter((ref) => {
					const target = path.resolve(ROOT, path.dirname(source.file), ref.specifier);
					return path.relative(ROOT, target).startsWith('..');
				})
				.map((ref) => `${source.file} → ${ref.specifier}`),
		);

		// Assert — the folder is self-contained: it is published and deployed on its own
		expect(escapes).toEqual([]);
	});

	it('AR-03: shipped code imports no package other than n8n-workflow', () => {
		// Act
		const packages = SHIPPED.flatMap((source) =>
			importsOf(source.code)
				.filter((ref) => !ref.specifier.startsWith('.') && !SHIPPED_PACKAGES.has(ref.specifier))
				.map((ref) => `${source.file} → ${ref.specifier}`),
		);

		// Assert — zero runtime dependencies, Node built-in modules included
		expect(packages).toEqual([]);
	});

	it('AR-04: shipped code reads neither environment variables nor files', () => {
		// Act
		const offenders = SHIPPED.filter((source) =>
			/\bprocess\s*\.\s*env\b|\b(readFileSync|writeFileSync|readdirSync|createReadStream)\b/.test(
				source.code,
			),
		);

		// Assert — n8n community-node rule; file access would already be
		// refused by AR-03 (`fs`), this covers indirect access
		expect(offenders.map((s) => s.file)).toEqual([]);
	});

	it('AR-05: the `country` transform stays offline', () => {
		// Act
		const country = SHIPPED.filter((source) => source.file.startsWith('transforms/country/'));
		const outside = country.flatMap((source) =>
			importsOf(source.code)
				.filter((ref) => ref.runtime)
				.map((ref) =>
					path
						.relative(ROOT, path.resolve(ROOT, path.dirname(source.file), ref.specifier))
						.split(path.sep)
						.join('/'),
				)
				.filter((target) => !target.startsWith('kernel/') && !target.startsWith('transforms/country/'))
				.map((target) => `${source.file} → ${target}`),
		);

		// Assert — ADR-0009 (`restcountries.com` incident of 2026-08-10): neither port nor adapter
		expect(country.length).toBeGreaterThanOrEqual(4);
		expect(outside).toEqual([]);
	});

	it('AR-10: each layer imports only the layers ADR-0010 allows', () => {
		// Arrange — type imports count too: they couple contracts. The composition roots
		// (`FormatTemplate.node.ts`, `executeV6.ts`) may import everything.
		const ALLOWED: ReadonlyArray<readonly [string, readonly string[]]> = [
			['kernel/', ['kernel/']],
			['engine/', ['kernel/', 'engine/']],
			['ports/', ['ports/']],
			['transforms/', ['kernel/', 'ports/', 'transforms/']],
			['adapters/', ['ports/', 'adapters/']],
			['v5/', ['v5/', 'transforms/country/countryCodes']],
		];

		// Act
		const violations = SHIPPED.flatMap((source) => {
			const rule = ALLOWED.find(([layer]) => source.file.startsWith(layer));
			if (!rule) return [];
			return importsOf(source.code)
				.filter((ref) => ref.specifier.startsWith('.'))
				.map((ref) =>
					path
						.relative(ROOT, path.resolve(ROOT, path.dirname(source.file), ref.specifier))
						.split(path.sep)
						.join('/'),
				)
				.filter((target) => !inLayer(target, [...rule[1]]))
				.map((target) => `${source.file} → ${target}`);
		});

		// Assert — the kernel and the engine know no port: the context a module needs
		// is bound where the modules are listed (`transforms/index.ts`)
		expect(SHIPPED.filter((source) => source.file.startsWith('adapters/')).length).toBeGreaterThanOrEqual(6);
		expect(violations).toEqual([]);
	});
});

describe('AR-06 — transform modules', () => {
	const knownCodes = new Set<string>(Object.values(FT_CODES));

	/** Folders of `transforms/`, and those that hold a `module.ts`. */
	const folders = fs
		.readdirSync(path.join(ROOT, 'transforms'), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	const moduleFolders = folders.filter((folder) =>
		fs.existsSync(path.join(ROOT, 'transforms', folder, 'module.ts')),
	);

	it('every folder of `transforms/` with a `module.ts` is a registered module, and vice versa', () => {
		// Assert — no hidden module, no registration without code
		expect(TRANSFORM_MODULES.map((module) => module.type).sort()).toEqual(moduleFolders);
	});

	it('a slice without a `module.ts` is inert: no shipped file outside it imports it', () => {
		// Arrange — a transformation under construction: its pure core is tested, but
		// nothing in the node can reach it until its module is registered
		const inert = folders.filter((folder) => !moduleFolders.includes(folder));

		// Act
		const reaches = SHIPPED.filter((source) => !inert.some((folder) => source.file.startsWith(`transforms/${folder}/`)))
			.flatMap((source) =>
				importsOf(source.code)
					.filter((ref) => ref.specifier.startsWith('.'))
					.map((ref) => path.relative(ROOT, path.resolve(ROOT, path.dirname(source.file), ref.specifier)))
					.map((target) => target.split(path.sep).join('/'))
					.filter((target) => inert.some((folder) => target.startsWith(`transforms/${folder}`)))
					.map((target) => `${source.file} → ${target}`),
			);

		// Assert
		expect(reaches).toEqual([]);
	});

	it.each(TRANSFORM_MODULES.map((module) => [module.type, module] as const))(
		'%s: complete identity and codes declared in the catalogue',
		(_type, module) => {
			// Assert
			expect(module.displayName).not.toBe('');
			expect(module.description).not.toBe('');
			expect(module.codes.length).toBeGreaterThan(0);
			expect(module.codes.filter((code) => !knownCodes.has(code))).toEqual([]);
			expect(new Set(module.codes).size).toBe(module.codes.length);
			// The condition on `type` is set by the engine, never by the module.
			expect(module.properties.filter((p) => p.displayOptions?.show?.type)).toEqual([]);
		},
	);

	it('types are unique', () => {
		// Assert
		const types = TRANSFORM_MODULES.map((module) => module.type);
		expect(new Set(types).size).toBe(types.length);
	});
});
