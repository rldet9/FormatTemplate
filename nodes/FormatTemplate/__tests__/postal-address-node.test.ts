/**
 * Postal address through the node (PA-N*)
 *
 * @module FormatTemplate/__tests__/postal-address-node
 *
 * @description
 * End to end: the node runs on a simulated n8n context whose
 * `helpers.httpRequest` serves the answers of the Géoplateforme service
 * recorded for the corpus. Everything else is the real stack — HTTP adapter,
 * retry, rate limit, cache, engine, module, verdict, postal lines.
 */

import type { IHttpRequestOptions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { FormatTemplate } from '../FormatTemplate.node';
import { FT_CODES } from '../kernel/diagnostics';
import { resolveAddressSettings } from '../transforms/postalAddress/params';
import { POSTAL_ADDRESS_PROPERTIES } from '../transforms/postalAddress/properties';
import { createMockExecute } from './helpers/mockExecute';
import { loadRecording } from './helpers/postalCorpus';

const node = new FormatTemplate();
const recording = loadRecording();

/** One row of `_format.fields[]`. */
type Trace = { path: string; target?: string; type: string; status: string; code?: string; message?: string };

/** A fake Géoplateforme service and the requests it received. */
interface FakeService {
	httpRequest: (options: IHttpRequestOptions) => Promise<unknown>;
	calls: IHttpRequestOptions[];
}

/**
 * Serves the recorded answers, or plays a script of failures first.
 *
 * @param failures - Answers to give before serving the recording: an HTTP status,
 *                   or `'down'` for a refused connection
 * @returns The fake service
 */
function banService(failures: Array<number | 'down'> = []): FakeService {
	const calls: IHttpRequestOptions[] = [];
	return {
		calls,
		httpRequest: async (options) => {
			calls.push(options);
			const failure = failures[calls.length - 1];
			if (failure === 'down') throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
			if (typeof failure === 'number') {
				return { statusCode: failure, headers: { 'retry-after': '0' }, body: { code: failure } };
			}
			const query = String((options.qs as { q: string }).q);
			const body = recording.responses[query] ?? { type: 'FeatureCollection', features: [] };
			return { statusCode: 200, headers: {}, body };
		},
	};
}

/** Options of a run. */
interface Run {
	rows: Array<Record<string, unknown>>;
	items: Array<{ json: Record<string, unknown> }>;
	service?: FakeService;
	onFieldError?: string;
	continueOnFail?: boolean;
}

/**
 * Executes the node in typeVersion 6.
 *
 * @param run - Configuration of the run
 * @returns Output items
 */
async function execute(run: Run): Promise<INodeExecutionData[]> {
	const { context } = createMockExecute({
		nodeParameters: {
			fieldsToFormat: { field: run.rows },
			onFieldError: run.onFieldError ?? 'tag',
			onMissingField: 'tag',
			options: {},
		},
		inputData: run.items,
		typeVersion: 6,
		nodeName: 'Format Template',
		continueOnFail: run.continueOnFail ?? false,
		httpRequest: (run.service ?? banService()).httpRequest,
	});
	const [output] = await node.execute.call(context);
	return output;
}

const row = (fields: Record<string, unknown> = {}) => ({ fieldPath: 'address', type: 'postalAddress', ...fields });
const trace = (item: INodeExecutionData) => (item.json._format as { status: string; fields: Trace[] });
const offline = { advanced: { maxRetries: 0 } };

describe('PA-N01 — a confirmed address is written to the standard', () => {
	it('replaces the field with the postal lines, complements kept', async () => {
		// Act
		const [item] = await execute({
			rows: [row()],
			items: [{ json: { address: 'Appartement 12\nBâtiment B\n10 rue de la Paix\n75002 Paris' } }],
		});

		// Assert
		expect(item.json.address).toEqual(['Appartement 12', 'Bâtiment B', '10 RUE DE LA PAIX', '75002 PARIS']);
		expect(trace(item)).toEqual({
			status: 'ok',
			fields: [{ path: 'address', type: 'postalAddress', status: 'ok' }],
		});
	});

	it('writes to outputPath and keeps the original', async () => {
		// Act
		const [item] = await execute({
			rows: [row({ outputFormat: 'structured', outputPath: 'checked.address' })],
			items: [{ json: { address: '12 rue de la Pais 75002 Paris' } }],
		});

		// Assert
		expect(item.json.address).toBe('12 rue de la Pais 75002 Paris');
		expect(item.json.checked).toEqual({
			address: expect.objectContaining({
				verdict: 'corrected',
				corrections: ['street'],
				postalLines: ['12 RUE DE LA PAIX', '75002 PARIS'],
				citycode: '75102',
				banId: expect.any(String),
			}),
		});
		expect(trace(item).fields[0]).toMatchObject({
			target: 'checked.address',
			status: 'ok',
			code: FT_CODES.ADDRESS_CORRECTED,
		});
	});

	it('works next to the other transformations', async () => {
		// Act
		const [item] = await execute({
			rows: [row({ outputFormat: 'label' }), { fieldPath: 'phone', type: 'phone' }],
			items: [{ json: { address: '8 bd du port amiens', phone: '+33 3 20 00 00 00' } }],
		});

		// Assert
		expect(item.json).toMatchObject({ address: '8 Boulevard du Port 80000 Amiens', phone: '03 20 00 00 00' });
	});
});

describe('PA-N02 — a refused address is never written', () => {
	it('tags the item and leaves the value under onFieldError: tag', async () => {
		// Act
		const [item] = await execute({
			rows: [row()],
			items: [{ json: { address: '3 bis avenue du Général de Gaulle 59000 Lille' } }],
		});

		// Assert
		expect(item.json.address).toBe('3 bis avenue du Général de Gaulle 59000 Lille');
		expect(trace(item).fields[0]).toMatchObject({ status: 'failed', code: FT_CODES.ADDRESS_MISMATCH });
		expect(trace(item).fields[0].message).not.toMatch(/Gaulle|Lille|59000/);
	});

	it('sends the item to the error output under onFieldError: throw', async () => {
		// Act
		const [item] = await execute({
			rows: [row()],
			items: [{ json: { address: '1 rue de la Gare' } }],
			onFieldError: 'throw',
			continueOnFail: true,
		});

		// Assert
		expect(item.json.error).toContain(FT_CODES.ADDRESS_AMBIGUOUS);
		expect(item.json.details).toMatchObject({ code: FT_CODES.ADDRESS_AMBIGUOUS });
	});

	it('leaves an empty value unchanged', async () => {
		// Act
		const [item] = await execute({ rows: [row()], items: [{ json: { address: '' } }] });

		// Assert
		expect(item.json.address).toBe('');
		expect(trace(item).fields[0]).toMatchObject({ status: 'unchanged', code: FT_CODES.VALUE_EMPTY });
	});
});

describe('PA-N03 — one request per distinct address, results in order', () => {
	it('asks the service once for a repeated address', async () => {
		// Arrange
		const service = banService();

		// Act
		await execute({
			rows: [row()],
			items: [
				{ json: { address: '12 rue de la Paix 75002 Paris' } },
				{ json: { address: '12 RUE DE LA PAIX 75002 PARIS' } },
				{ json: { address: '20 avenue de Ségur 75007 Paris' } },
			],
			service,
		});

		// Assert
		expect(service.calls).toHaveLength(2);
	});

	it('keeps the output in input order, pairedItem included', async () => {
		// Arrange
		const addresses = ['12 rue de la Paix 75002 Paris', '20 avenue de Ségur 75007 Paris', 'Place Bellecour 69002 Lyon'];
		const items = [...Array(12).keys()].map((index) => ({ json: { address: addresses[index % 3], index } }));

		// Act
		const output = await execute({ rows: [row({ outputFormat: 'label' })], items });

		// Assert
		expect(output.map((item) => item.json.index)).toEqual([...Array(12).keys()]);
		expect(output.map((item) => item.pairedItem)).toEqual([...Array(12).keys()].map((item) => ({ item })));
		expect(output[4].json.address).toBe('20 Avenue de Ségur 75007 Paris');
	});
});

describe('PA-N04 — a service failure is never an invalid address (ADR-0015)', () => {
	const items = [{ json: { address: '12 rue de la Paix 75002 Paris' } }, { json: { address: '20 avenue de Ségur 75007 Paris' } }];

	it('fails the node by default when n8n stops on error', async () => {
		// Act & Assert — n8n's Retry On Fail can then replay the execution
		await expect(
			execute({ rows: [row(offline)], items, service: banService(['down', 'down']) }),
		).rejects.toThrow(FT_CODES.ADDRESS_SERVICE_UNAVAILABLE);
	});

	it('sends the failed items out as error items when n8n continues — never through unchecked', async () => {
		// Arrange — a node that throws under On Error "Continue" has its input items passed
		// through unchanged by n8n, on the success output: an unverified address would go on
		// as if checked. The node therefore attaches the failure to each item instead.
		const run = (onServiceError?: string) =>
			execute({
				rows: [row(onServiceError ? { ...offline, onServiceError } : offline)],
				items,
				service: banService(['down', 'down']),
				continueOnFail: true,
			});

		// Act
		const byDefault = await run();
		const explicit = await run('throw');

		// Assert — every item is an error item; the default is `throw`
		expect(byDefault.map((item) => (item.json.details as { code: string }).code)).toEqual([
			FT_CODES.ADDRESS_SERVICE_UNAVAILABLE,
			FT_CODES.ADDRESS_SERVICE_UNAVAILABLE,
		]);
		expect(byDefault.map((item) => Object.keys(item.json).sort())).toEqual([
			['details', 'error'],
			['details', 'error'],
		]);
		expect(byDefault).toEqual(explicit);
	});

	it('keeps the value and tags the item under onServiceError: tag — whatever n8n is set to', async () => {
		// Act
		const run = (continueOnFail: boolean) =>
			execute({
				rows: [row({ ...offline, onServiceError: 'tag' })],
				items: [items[0]],
				service: banService(['down']),
				continueOnFail,
			});
		const [stopped] = await run(false);
		const [continued] = await run(true);

		// Assert — the item goes out normally, the failure said in `_format`
		expect(stopped.json.address).toBe('12 rue de la Paix 75002 Paris');
		expect(trace(stopped).fields[0]).toMatchObject({ status: 'failed', code: FT_CODES.ADDRESS_SERVICE_UNAVAILABLE });
		expect({ address: continued.json.address, _format: continued.json._format }).toEqual({
			address: stopped.json.address,
			_format: stopped.json._format,
		});
	});

	it('is not caught by onFieldError: keep', async () => {
		// Act & Assert — the data policy never silences a service failure
		await expect(
			execute({ rows: [row(offline)], items: [items[0]], service: banService(['down']), onFieldError: 'keep' }),
		).rejects.toThrow(FT_CODES.ADDRESS_SERVICE_UNAVAILABLE);
	});

	it('retries a 429, then answers', async () => {
		// Arrange
		const service = banService([429]);

		// Act
		const [item] = await execute({ rows: [row({ advanced: { maxRetries: 1 } })], items: [items[0]], service });

		// Assert
		expect(service.calls).toHaveLength(2);
		expect(item.json.address).toEqual(['12 RUE DE LA PAIX', '75002 PARIS']);
	});

	it('never retries a rejected request', async () => {
		// Arrange
		const service = banService([400]);

		// Act & Assert
		await expect(execute({ rows: [row()], items: [items[0]], service })).rejects.toThrow(
			FT_CODES.ADDRESS_SERVICE_REJECTED,
		);
		expect(service.calls).toHaveLength(1);
	});
});

describe('PA-N05 — configuration errors stop the node before any request', () => {
	it.each([
		[{ advanced: { baseUrl: 'http://data.geopf.fr/geocodage' } }, FT_CODES.ADDRESS_ENDPOINT_INVALID],
		[{ advanced: { baseUrl: 'not a url' } }, FT_CODES.ADDRESS_ENDPOINT_INVALID],
		[{ outputPath: 'checked-address' }, FT_CODES.PATH_INVALID],
		[{ outputPath: '__proto__.x' }, FT_CODES.PATH_RESERVED],
	])('%j → %s', async (fields, code) => {
		// Arrange
		const service = banService();

		// Act & Assert
		await expect(
			execute({ rows: [row(fields)], items: [{ json: { address: '12 rue de la Paix 75002 Paris' } }], service, continueOnFail: true }),
		).rejects.toThrow(code);
		expect(service.calls).toHaveLength(0);
	});
});

describe('PA-N06 — the interface shows the defaults the node applies', () => {
	it('every default of the row equals the runtime default', () => {
		// Arrange — the interface declares literals, because n8n's linter reads them from
		// the source; the runtime resolves a row from `ADDRESS_DEFAULTS`. They must not drift.
		const flatten = (properties: readonly INodeProperties[]): INodeProperties[] =>
			properties.flatMap((property) =>
				property.type === 'collection' ? (property.options as INodeProperties[]) : [property],
			);
		const runtime = resolveAddressSettings({}) as unknown as Record<string, unknown>;

		// Act
		const shown = Object.fromEntries(
			flatten(POSTAL_ADDRESS_PROPERTIES)
				.filter((property) => property.name in runtime)
				.map((property) => [property.name, property.default]),
		);

		// Assert — the twelve settings, shown as applied
		expect(Object.keys(shown)).toHaveLength(12);
		expect(shown).toEqual(runtime);
	});
});
