/**
 * `fieldPath` — reading, writing and checking the shape of field paths
 *
 * @version 1.0.0
 * @module FormatTemplate/kernel/fieldPath
 *
 * @description
 * typeVersion 5 mixed two different questions — "is this a path?" and "does
 * this path exist?" — in a single syntactic check, and had no policy for the
 * second one (ADR-0003).
 *
 * Three responsibilities, kept apart here:
 *
 * 1. **Shape** — `parseFieldPath` accepts the paths n8n can write and the
 *    node can read, and nothing else: property segments separated by `.`,
 *    plus the array index `[0]`.
 * 2. **Safety** — `__proto__`, `constructor` and `prototype` are refused at
 *    any depth (prototype pollution).
 * 3. **Provenance** — `looksLikeExpressionPath` spots a path that comes from
 *    an n8n expression, hence probably a **value** disguised as a path.
 *
 * Pure module — no import of `n8n-workflow`.
 */

/** Keys refused at any depth — prototype pollution. */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** A segment: a property name, then as many `[n]` indices as wanted. */
const SEGMENT_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*(\[\d+\])*$/;

/** Atomic element of a parsed path. */
export type PathToken = { kind: 'key'; name: string } | { kind: 'index'; position: number };

/** Result of parsing a `fieldPath`. */
export type ParsedFieldPath =
	| { ok: true; tokens: PathToken[] }
	| { ok: false; reason: 'invalid' | 'reserved'; message: string };

/**
 * Parses a `fieldPath` and returns its tokens, or the reason it is refused.
 *
 * @param fieldPath - Path as configured (`contact.mobile`, `addresses[0].country`)
 * @returns Path tokens, or the reason for refusal
 *
 * @example
 * ```ts
 * parseFieldPath('addresses[0].country');
 * // { ok: true, tokens: [{kind:'key',name:'addresses'}, {kind:'index',position:0}, …] }
 * parseFieldPath('postal-address.country'); // { ok: false, reason: 'invalid', … }
 * ```
 */
export function parseFieldPath(fieldPath: string): ParsedFieldPath {
	if (typeof fieldPath !== 'string' || fieldPath.trim() === '') {
		return {
			ok: false,
			reason: 'invalid',
			message:
				'Invalid path format: "". Specify the name of the property (like "phone"), not its value.',
		};
	}

	const tokens: PathToken[] = [];
	for (const segment of fieldPath.split('.')) {
		if (!SEGMENT_PATTERN.test(segment)) {
			return {
				ok: false,
				reason: 'invalid',
				message:
					`Invalid path format: "${fieldPath}". Specify the name of the property ` +
					'(like "phone"), not its value.',
			};
		}

		const name = segment.replace(/\[\d+\]/g, '');
		if (RESERVED_KEYS.has(name)) {
			return {
				ok: false,
				reason: 'reserved',
				message: `Path refused: "${fieldPath}" targets the reserved key "${name}".`,
			};
		}
		tokens.push({ kind: 'key', name });

		for (const index of segment.match(/\[\d+\]/g) ?? []) {
			tokens.push({ kind: 'index', position: Number(index.slice(1, -1)) });
		}
	}

	return { ok: true, tokens };
}

/**
 * Tells whether a `fieldPath` is syntactically readable by the node.
 *
 * @param fieldPath - Path to check
 * @returns `true` if the path is acceptable
 *
 * @example
 * ```ts
 * isValidFieldPath('contact.mobile'); // true
 * isValidFieldPath('France ');        // false
 * ```
 */
export function isValidFieldPath(fieldPath: string): boolean {
	return parseFieldPath(fieldPath).ok;
}

/** Result of a read by path. */
export interface PathLookup {
	/** `true` if the path is present in the object, even with a null value. */
	found: boolean;
	/** Value read, `undefined` when missing. */
	value: unknown;
}

/**
 * Reads a value by parsed path.
 *
 * @param root - Root object (the item's `json`)
 * @param tokens - Tokens returned by {@link parseFieldPath}
 * @returns Presence and value
 *
 * @remarks
 * Presence is told apart from the value `undefined`: this is what lets
 * typeVersion 6 separate `FT_PATH_NOT_FOUND` (the field does not exist) from
 * `FT_VALUE_EMPTY` (it exists and carries nothing).
 *
 * @example
 * ```ts
 * readAtPath({ address: { country: 'France' } }, parse('address.country').tokens);
 * // { found: true, value: 'France' }
 * ```
 */
export function readAtPath(root: unknown, tokens: PathToken[]): PathLookup {
	let current: unknown = root;
	for (const token of tokens) {
		if (current === null || current === undefined) return { found: false, value: undefined };
		if (token.kind === 'index') {
			if (!Array.isArray(current) || token.position >= current.length) {
				return { found: false, value: undefined };
			}
			current = current[token.position];
			continue;
		}
		if (typeof current !== 'object') return { found: false, value: undefined };
		if (!Object.prototype.hasOwnProperty.call(current, token.name)) {
			return { found: false, value: undefined };
		}
		current = (current as Record<string, unknown>)[token.name];
	}
	return { found: true, value: current };
}

/**
 * Writes a value by parsed path, creating missing containers.
 *
 * @param root - Root object, mutated in place
 * @param tokens - Tokens returned by {@link parseFieldPath}
 * @param value - Value to write
 *
 * @remarks
 * The node only writes to a path it has first **read**: creating containers
 * only serves edge cases (an array shortened between read and write).
 * Reserved keys are already refused by `parseFieldPath`.
 *
 * @example
 * ```ts
 * writeAtPath(item, parse('contact.mobile').tokens, '06 12 34 56 78');
 * ```
 */
export function writeAtPath(root: Record<string, unknown>, tokens: PathToken[], value: unknown): void {
	let current: unknown = root;
	for (let i = 0; i < tokens.length - 1; i++) {
		const token = tokens[i];
		const next = tokens[i + 1];
		const container = next.kind === 'index' ? [] : {};

		if (token.kind === 'index') {
			const holder = current as unknown[];
			if (holder[token.position] === null || typeof holder[token.position] !== 'object') {
				holder[token.position] = container;
			}
			current = holder[token.position];
			continue;
		}

		const holder = current as Record<string, unknown>;
		if (holder[token.name] === null || typeof holder[token.name] !== 'object') {
			holder[token.name] = container;
		}
		current = holder[token.name];
	}

	const last = tokens[tokens.length - 1];
	if (last.kind === 'index') {
		(current as unknown[])[last.position] = value;
	} else {
		(current as Record<string, unknown>)[last.name] = value;
	}
}

/**
 * Spots a `fieldPath` that comes from an n8n expression.
 *
 * @param rawValue - **Raw** parameter value, read from `getNode().parameters`
 * @param resolvedValue - Resolved value, read through `getNodeParameter`
 * @returns `true` if the resolved path comes from an evaluated expression
 *
 * @remarks
 * A `fieldPath` stored as `=domain.phone` "works by chance": n8n evaluates
 * the string, which contains no `{{ }}`, and returns the literal text. The day
 * it becomes `={{ $json.country }}`, it returns a **value** — and the node
 * looks for a field named `France`.
 *
 * Only the costly case is reported: an expression that actually changed the
 * string. An unchanged `=domain.phone` is not a warning.
 *
 * @example
 * ```ts
 * looksLikeExpressionPath('=domain.phone', 'domain.phone');  // false
 * looksLikeExpressionPath('={{ $json.country }}', 'France'); // true
 * ```
 */
export function looksLikeExpressionPath(rawValue: unknown, resolvedValue: string): boolean {
	if (typeof rawValue !== 'string' || !rawValue.startsWith('=')) return false;
	return rawValue.slice(1) !== resolvedValue;
}
