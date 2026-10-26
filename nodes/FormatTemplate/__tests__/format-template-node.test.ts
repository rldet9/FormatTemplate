/**
 * v6 loop of the `formatTemplate` node
 *
 * @module FormatTemplate/__tests__/format-template-node
 *
 * @description
 * `onFieldError`, `onMissingField`, `continueOnFail`, error output,
 * `pairedItem`, `_format`, `traceValues`.
 *
 * n8n convention for the error output: the node pushes **all** its items on
 * `main`, the failed ones carrying `json.error` and `json.details` — nothing
 * else; n8n itself routes them to the second output when `onError` is
 * `continueErrorOutput`, merging the paired input item back in. These tests
 * cover what the node pushes; the routing itself was proven by an acceptance
 * run on a real n8n instance (FTN-07, ADR-0011).
 */

import type { INodeExecutionData } from 'n8n-workflow';

import { createMockExecute } from './helpers/mockExecute';
import { FT_CODES } from '../kernel/diagnostics';
import { FormatTemplate } from '../FormatTemplate.node';
import { countryModule } from '../transforms/country/module';

const node = new FormatTemplate();

/** One row of `_format.fields[]`, as written on the item. */
type Trace = {
	path: string;
	type: string;
	status: string;
	code?: string;
	message?: string;
	before?: string;
	after?: string;
};

/** v6 run options. */
interface RunOptions {
	fields: Array<Record<string, unknown>>;
	items: Array<{ json: Record<string, unknown>; binary?: Record<string, unknown> }>;
	onFieldError?: string;
	onMissingField?: string;
	options?: Record<string, unknown>;
	continueOnFail?: boolean;
	/** Raw rows, when they differ from the resolved rows (expressions). */
	rawFields?: Array<Record<string, unknown>>;
}

/**
 * Runs the node in typeVersion 6.
 *
 * @param run - Run configuration
 * @returns Items pushed on the single output
 */
async function runV6(run: RunOptions): Promise<INodeExecutionData[]> {
	const { context } = createMockExecute({
		nodeParameters: {
			fieldsToFormat: { field: run.rawFields ?? run.fields },
			onFieldError: run.onFieldError ?? 'tag',
			onMissingField: run.onMissingField ?? 'tag',
			options: run.options ?? {},
		},
		inputData: run.items,
		typeVersion: 6,
		nodeName: 'Format Template',
		continueOnFail: run.continueOnFail ?? false,
		// `getNodeParameter` returns the resolved rows; `getNode().parameters` keeps
		// the raw rows — exactly the gap the node relies on to detect a path that came
		// from an expression.
		expressions: run.rawFields
			? { 'fieldsToFormat.field': () => run.fields }
			: undefined,
	});
	const [output] = await node.execute.call(context);
	return output;
}

/** Shortcut: the trace of an item. */
const trace = (item: INodeExecutionData) =>
	(item.json._format as { status: string; fields: Trace[] }) ?? undefined;

describe('FTN-01 — a faulty item no longer destroys the batch', () => {
	const FIELDS = [{ fieldPath: 'country', type: 'country' }];
	const CONTACTS = [
		{ json: { country: 'France' } },
		{ json: { country: 'Bretagne' } },
		{ json: { country: 'Belgique' } },
	];

	it('`onFieldError: tag`: three items out, two converted, one diagnosed', async () => {
		// Act — acceptance criterion (ADR-0001)
		const output = await runV6({ fields: FIELDS, items: CONTACTS });

		// Assert
		expect(output).toHaveLength(3);
		expect(output[0].json.country).toBe('FR');
		expect(output[1].json.country).toBe('Bretagne');
		expect(output[2].json.country).toBe('BE');
		expect(trace(output[1]).fields[0]).toMatchObject({
			path: 'country',
			status: 'failed',
			code: FT_CODES.COUNTRY_UNKNOWN,
		});
		expect(trace(output[1]).status).toBe('failed');
	});

	it('`onFieldError: throw` + `continueOnFail`: two items converted, one in error', async () => {
		// Act — acceptance criterion (ADR-0001), second row
		const output = await runV6({
			fields: FIELDS,
			items: CONTACTS,
			onFieldError: 'throw',
			continueOnFail: true,
		});

		// Assert
		expect(output).toHaveLength(3);
		expect(output[0].json.country).toBe('FR');
		expect(output[2].json.country).toBe('BE');
		expect(output[1].json.error).toContain(FT_CODES.COUNTRY_UNKNOWN);
		expect(output[1].pairedItem).toEqual({ item: 1 });
	});

	it('`onFieldError: throw` without `continueOnFail`: the node fails, naming the faulty item', async () => {
		// Act & Assert
		await expect(
			runV6({ fields: FIELDS, items: CONTACTS, onFieldError: 'throw' }),
		).rejects.toThrow(FT_CODES.COUNTRY_UNKNOWN);
	});

	it('`onFieldError: keep`: the value stays and nothing is said — silence by choice', async () => {
		// Act
		const output = await runV6({
			fields: FIELDS,
			items: [{ json: { country: 'Bretagne' } }],
			onFieldError: 'keep',
		});

		// Assert
		expect(output[0].json.country).toBe('Bretagne');
		expect(trace(output[0]).fields).toEqual([]);
	});

	it('a configuration error fails the node whatever the policy', async () => {
		// Arrange — an unknown type is not faulty data
		const run = {
			fields: [{ fieldPath: 'phone', type: 'iban' }],
			items: [{ json: { phone: '0320000000' } }],
			onFieldError: 'tag',
		};

		// Act & Assert
		await expect(runV6(run)).rejects.toThrow(FT_CODES.TYPE_UNKNOWN);
	});

	it('an invalid mask fails the node before the loop, even without items', async () => {
		// Act & Assert
		await expect(
			runV6({
				fields: [
					{ fieldPath: 'phone', type: 'phone', phoneOutput: 'mask', phoneMask: '+33' },
				],
				items: [],
			}),
		).rejects.toThrow(FT_CODES.PHONE_MASK_INVALID);
	});
});

describe('FTN-02 — missing field and invalid path', () => {
	it('`onMissingField: tag`: the item goes out, the trace carries the requested path', async () => {
		// Act — acceptance criterion (ADR-0003)
		const output = await runV6({
			fields: [{ fieldPath: 'adresse.pays', type: 'country' }],
			items: [{ json: { nom: 'Durand' } }],
		});

		// Assert
		expect(output).toHaveLength(1);
		expect(trace(output[0]).fields[0]).toMatchObject({
			path: 'adresse.pays',
			status: 'skipped',
			code: FT_CODES.PATH_NOT_FOUND,
		});
		expect(trace(output[0]).status).toBe('partial');
	});

	it('`onMissingField: skip`: nothing in the trace', async () => {
		// Act
		const output = await runV6({
			fields: [{ fieldPath: 'adresse.pays', type: 'country' }],
			items: [{ json: { nom: 'Durand' } }],
			onMissingField: 'skip',
		});

		// Assert
		expect(trace(output[0]).fields).toEqual([]);
		expect(trace(output[0]).status).toBe('ok');
	});

	it('`onMissingField: error`: the item goes to error', async () => {
		// Act & Assert
		await expect(
			runV6({
				fields: [{ fieldPath: 'adresse.pays', type: 'country' }],
				items: [{ json: { nom: 'Durand' } }],
				onMissingField: 'error',
			}),
		).rejects.toThrow(FT_CODES.PATH_NOT_FOUND);
	});

	it('`adresse[0].pays` works', async () => {
		// Act
		const output = await runV6({
			fields: [{ fieldPath: 'adresse[0].pays', type: 'country' }],
			items: [{ json: { adresse: [{ pays: 'France' }] } }],
		});

		// Assert
		expect(output[0].json.adresse).toEqual([{ pays: 'FR' }]);
	});

	it('`adresse-postale.pays` fails the node as a configuration error', async () => {
		// Act & Assert
		await expect(
			runV6({
				fields: [{ fieldPath: 'adresse-postale.pays', type: 'country' }],
				items: [{ json: { pays: 'France' } }],
			}),
		).rejects.toThrow(FT_CODES.PATH_INVALID);
	});

	it('rejects a reserved path', async () => {
		// Act & Assert
		await expect(
			runV6({
				fields: [{ fieldPath: 'a.__proto__.b', type: 'country' }],
				items: [{ json: { a: {} } }],
			}),
		).rejects.toThrow(FT_CODES.PATH_RESERVED);
	});

	it('flags a `fieldPath` that came from an expression, and does not format a field named after a value', async () => {
		// Arrange — the stored parameter is an expression, and it returned "France"
		const output = await runV6({
			rawFields: [{ fieldPath: '={{ $json.pays }}', type: 'country' }],
			fields: [{ fieldPath: 'France', type: 'country' }],
			items: [{ json: { pays: 'France' } }],
		});

		// Assert — the field "France" does not exist: nothing was rewritten, and the trace says so
		expect(output[0].json.pays).toBe('France');
		expect(trace(output[0]).fields[0]).toMatchObject({
			path: 'France',
			status: 'skipped',
			code: FT_CODES.PATH_NOT_FOUND,
		});
		expect(trace(output[0]).fields[0].message).toContain(FT_CODES.PATH_FROM_EXPRESSION);
	});

	it('does not flag a `=domain.phone`, which works (27 such rows in production)', async () => {
		// Act
		const output = await runV6({
			rawFields: [{ fieldPath: '=domain.phone', type: 'phone' }],
			fields: [{ fieldPath: 'domain.phone', type: 'phone' }],
			items: [{ json: { domain: { phone: '0320000000' } } }],
		});

		// Assert
		expect((output[0].json.domain as Record<string, unknown>).phone).toBe('03 20 00 00 00');
		expect(trace(output[0]).fields[0]).toMatchObject({ status: 'ok' });
		expect(trace(output[0]).fields[0].code).toBeUndefined();
	});
});

describe('FTN-03 — the `_format` trace', () => {
	it('a set of fields mixing success, missing field and failure yields `partial`', async () => {
		// Act — acceptance criterion
		const output = await runV6({
			fields: [
				{ fieldPath: 'country', type: 'country' },
				{ fieldPath: 'adresse.pays', type: 'country' },
				{ fieldPath: 'phone', type: 'phone' },
			],
			items: [{ json: { country: 'France', phone: '04 77 00 00' } }],
		});

		// Assert — one entry per configured row
		const format = trace(output[0]);
		expect(format.status).toBe('partial');
		expect(format.fields).toHaveLength(3);
		expect(format.fields.map((f) => f.status)).toEqual(['ok', 'skipped', 'failed']);
	});

	it('writes no original value when `traceValues` is false (ADR-0006)', async () => {
		// Act
		const output = await runV6({
			fields: [
				{ fieldPath: 'name', type: 'textCase', textCase: 'titleCase' },
				{ fieldPath: 'phone', type: 'phone' },
			],
			items: [{ json: { name: 'ÉLISE DURAND', phone: '04 77 00 00' } }],
		});

		// Assert — the value is searched for in the serialized JSON of the trace
		const serialized = JSON.stringify(output[0].json._format);
		expect(serialized).not.toContain('ÉLISE DURAND');
		expect(serialized).not.toContain('04 77 00 00');
		expect(serialized).not.toContain('0477');
	});

	it('`traceValues` adds `before`/`after`, truncated to 64 characters', async () => {
		// Arrange
		const long = 'a'.repeat(200);

		// Act
		const output = await runV6({
			fields: [{ fieldPath: 'name', type: 'textCase', textCase: 'uppercase' }],
			items: [{ json: { name: long } }],
			options: { traceValues: true },
		});

		// Assert
		const entry = trace(output[0]).fields[0];
		expect(entry.before).toHaveLength(65); // 64 characters + the truncation character
		expect(entry.after).toBe('A'.repeat(64) + '…');
	});

	it('appends a `metadata.messageHistory` entry, as EIP-style nodes do', async () => {
		// Act
		const output = await runV6({
			fields: [{ fieldPath: 'country', type: 'country' }],
			items: [{ json: { country: 'France', metadata: { correlationId: 'abc' } } }],
		});

		// Assert
		const metadata = output[0].json.metadata as { correlationId: string; messageHistory: Array<Record<string, unknown>> };
		expect(metadata.correlationId).toBe('abc');
		expect(metadata.messageHistory).toHaveLength(1);
		expect(metadata.messageHistory[0]).toMatchObject({
			nodeName: 'Format Template',
			nodeType: 'FormatTemplate',
			status: 'completed',
		});
	});

	it('`enrichMetadata: false` writes neither `_format` nor `messageHistory`', async () => {
		// Act
		const output = await runV6({
			fields: [{ fieldPath: 'country', type: 'country' }],
			items: [{ json: { country: 'France' } }],
			options: { enrichMetadata: false },
		});

		// Assert
		expect(output[0].json._format).toBeUndefined();
		expect(output[0].json.metadata).toBeUndefined();
		expect(output[0].json.country).toBe('FR');
	});
});

describe('FTN-04 — an unexpected exception becomes a typed diagnostic', () => {
	/**
	 * Replaces the `country` transform with one that throws.
	 *
	 * @returns Restore function
	 */
	function breakCountryHandler(): () => void {
		// The engine reads `module.run` at call time: replacing the method is enough.
		const spy = jest.spyOn(countryModule, 'run').mockImplementation(() => {
			throw new TypeError('broken handler');
		});
		return () => spy.mockRestore();
	}

	it('`tag`: the item goes out with `FT_INTERNAL_ERROR`, never without a diagnostic', async () => {
		// Arrange
		const restore = breakCountryHandler();
		try {
			// Act
			const output = await runV6({
				fields: [{ fieldPath: 'country', type: 'country' }],
				items: [{ json: { country: 'France' } }],
			});

			// Assert — v5 pushed the original item, without any marker
			expect(trace(output[0]).fields[0]).toMatchObject({
				status: 'failed',
				code: FT_CODES.INTERNAL_ERROR,
			});
		} finally {
			restore();
		}
	});

	it('`throw`: the node fails with `FT_INTERNAL_ERROR` and the item index', async () => {
		// Arrange
		const restore = breakCountryHandler();
		try {
			// Act & Assert
			await expect(
				runV6({
					fields: [{ fieldPath: 'country', type: 'country' }],
					items: [{ json: { a: 1 } }, { json: { country: 'France' } }],
					onFieldError: 'throw',
				}),
			).rejects.toThrow(FT_CODES.INTERNAL_ERROR);
		} finally {
			restore();
		}
	});
});

describe('FTN-05 — item pairing', () => {
	it('the three `pairedItem` point to the right index, the failed item included', async () => {
		// Act — acceptance criterion
		const output = await runV6({
			fields: [{ fieldPath: 'country', type: 'country' }],
			items: [
				{ json: { country: 'France' } },
				{ json: { country: 'Bretagne' } },
				{ json: { country: 'Belgique' } },
			],
			onFieldError: 'throw',
			continueOnFail: true,
		});

		// Assert
		expect(output.map((item) => item.pairedItem)).toEqual([
			{ item: 0 },
			{ item: 1 },
			{ item: 2 },
		]);
	});
});

describe('FTN-06 — both typeVersions coexist', () => {
	it('exposes both versions under the same public type', () => {
		// Assert
		expect(node.description.name).toBe('formatTemplate');
		expect(node.description.version).toEqual([5, 6]);
		expect((node.description as { defaultVersion?: number }).defaultVersion).toBe(6);
	});

	it('a node left on typeVersion 5 rejects `titleCase` instead of doing nothing', async () => {
		// Arrange
		const { context } = createMockExecute({
			nodeParameters: {
				fieldsToFormat: {
					field: [{ fieldPath: 'name', type: 'textCase', textCase: 'titleCase' }],
				},
			},
			inputData: [{ json: { name: 'sarl dupont' } }],
			typeVersion: 5,
		});

		// Act & Assert
		await expect(node.execute.call(context)).rejects.toThrow('typeVersion 6');
	});

	it('binary data passes through v6', async () => {
		// Act
		const output = await runV6({
			fields: [{ fieldPath: 'country', type: 'country' }],
			items: [{ json: { country: 'France' }, binary: { data: { fileName: 'a.pdf' } } }],
		});

		// Assert
		expect(output[0].binary).toEqual({ data: { fileName: 'a.pdf' } });
	});
});

describe('FTN-07 — gaps found by an acceptance run on a real n8n 2.37.11 instance (ADR-0011)', () => {
	it('carries only error/details, without `item.error` — the only shape n8n both routes AND keeps', async () => {
		// Arrange — two n8n-core constraints, measured on a real n8n 2.37.11 instance (2026-09-16):
		// - `handleNodeErrorOutput` routes to the error output only if `item.error` is set
		//   or if `json` carries ONLY error/message/details (a `_format` key next to them kept the
		//   item on the success output);
		// - an `item.error` makes n8n rewrite `json` as `{ error }` alone (the trace and the
		//   original data were lost).
		const output = await runV6({
			fields: [{ fieldPath: 'country', type: 'country' }],
			items: [{ json: { country: 'France' } }, { json: { country: 'Bretagne' } }],
			onFieldError: 'throw',
			continueOnFail: true,
		});

		// Assert
		const failed = output[1];
		expect(Object.keys(failed.json).sort()).toEqual(['details', 'error']);
		expect(failed.error).toBeUndefined();
		expect(failed.json.error).toContain(FT_CODES.COUNTRY_UNKNOWN);
		expect(output[0].json.error).toBeUndefined();
	});

	it('traces the field that sent the item to error, in `details`', async () => {
		// Act
		const output = await runV6({
			fields: [{ fieldPath: 'country', type: 'country' }],
			items: [{ json: { country: 'Bretagne' } }],
			onFieldError: 'throw',
			continueOnFail: true,
		});

		// Assert — the acceptance run showed `fields: []`
		const details = output[0].json.details as {
			code: string;
			_format: { status: string; fields: Trace[] };
		};
		expect(details.code).toBe(FT_CODES.COUNTRY_UNKNOWN);
		expect(details._format.fields).toEqual([
			expect.objectContaining({ path: 'country', status: 'failed', code: FT_CODES.COUNTRY_UNKNOWN }),
		]);
	});

	it('a configuration error fails the node even with `continueOnFail`', async () => {
		// Arrange — the expression returns a value with a space: an invalid path, not faulty data
		const run = {
			rawFields: [{ fieldPath: '={{ $json.pays }}', type: 'country' }],
			fields: [{ fieldPath: 'france ', type: 'country' }],
			items: [{ json: { pays: 'france ' } }],
			continueOnFail: true,
		};

		// Act & Assert
		await expect(runV6(run)).rejects.toThrow(FT_CODES.PATH_INVALID);
	});

	it('an invalid literal path fails before the loop, even without items', async () => {
		// Act & Assert
		await expect(
			runV6({ fields: [{ fieldPath: 'adresse-postale.pays', type: 'country' }], items: [] }),
		).rejects.toThrow(FT_CODES.PATH_INVALID);
	});

	it('keeps the cause of a lost zero behind the length mismatch', async () => {
		// Act — the acceptance run showed only FT_PHONE_LENGTH_MISMATCH for a mobile number imported as a number
		const output = await runV6({
			fields: [{ fieldPath: 'mobile', type: 'phone' }],
			items: [{ json: { mobile: 612345678 } }],
		});

		// Assert
		const entry = trace(output[0]).fields[0];
		expect(entry.code).toBe(FT_CODES.PHONE_LENGTH_MISMATCH);
		expect(entry.message).toContain(FT_CODES.PHONE_NUMERIC_INPUT);
	});
});
