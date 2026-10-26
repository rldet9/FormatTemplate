/**
 * Simulated n8n execution context for the node's tests
 *
 * @version 1.0.0
 * @module FormatTemplate/__tests__/helpers/mockExecute
 *
 * @description
 * A minimal simulated n8n execution context: it simulates the n8n context
 * without simulating the logic under test. This module mirrors only the context
 * surface — reading parameters, evaluating expressions, accessing items —
 * never a decision (classification, routing or validation).
 *
 * It lives inside the node folder because the folder imports nothing from
 * outside itself, tests included, so that it can be published as is
 * (architecture test AR-03).
 */

import type { IExecuteFunctions, IHttpRequestOptions, INodeExecutionData } from 'n8n-workflow';

/** Simplified input item. */
export type MockItem = { json: Record<string, unknown>; binary?: Record<string, unknown> };

/** Options used to build the simulated context. */
export interface MockExecuteOptions {
	/** Node parameters, read by `getNodeParameter`. */
	nodeParameters: Record<string, unknown>;
	/** Input items; a flat array means "a single input". */
	inputData: MockItem[] | MockItem[][];
	/** typeVersion to expose; defaults to 1. */
	typeVersion?: number;
	/** Name of the node in the workflow. */
	nodeName?: string;
	/**
	 * Expression evaluations, by parameter name.
	 *
	 * @remarks
	 * The function receives the item index: this is what lets a test prove that
	 * a node evaluates the expression of the **right** item.
	 * Throwing from this function simulates a broken n8n expression.
	 */
	expressions?: Record<string, (itemIndex: number) => unknown>;
	/** Value returned by `continueOnFail()`. */
	continueOnFail?: boolean;
	/** Unconnected inputs: `getInputData(i)` throws on them, as n8n does. */
	unconnectedInputs?: number[];
	/**
	 * Stand-in for `helpers.httpRequest`: the network is never reached from a test.
	 * Absent, any request fails as if the service could not be reached.
	 */
	httpRequest?: (options: IHttpRequestOptions) => Promise<unknown>;
}

/** Simulated context, plus the collected logs. */
export interface MockExecuteContext {
	context: IExecuteFunctions;
	logs: { debug: string[]; info: string[]; warn: string[]; error: string[] };
}

/**
 * Builds a simulated n8n execution context.
 *
 * @param options - Parameters, items and expression evaluations
 * @returns Context usable with `execute.call(context)`
 *
 * @example
 * ```ts
 * const { context } = createMockExecute({
 *   nodeParameters: { fieldsToFormat: { field: [{ fieldPath: 'country', type: 'country' }] } },
 *   inputData: [{ json: { country: 'France' } }],
 *   typeVersion: 6,
 * });
 * const [output] = await new FormatTemplate().execute.call(context);
 * ```
 */
export function createMockExecute(options: MockExecuteOptions): MockExecuteContext {
	const {
		nodeParameters,
		inputData,
		typeVersion = 1,
		nodeName = 'Test node',
		expressions = {},
		continueOnFail = false,
		unconnectedInputs = [],
		httpRequest = async () => {
			throw Object.assign(new Error('no network in tests'), { code: 'ECONNREFUSED' });
		},
	} = options;

	const inputs: MockItem[][] = Array.isArray(inputData[0])
		? (inputData as MockItem[][])
		: [inputData as MockItem[]];

	const logs = { debug: [] as string[], info: [] as string[], warn: [] as string[], error: [] as string[] };

	/**
	 * Reads a parameter value in dot notation, as n8n does for
	 * `fieldsToFormat.field`.
	 */
	const readParameter = (name: string): unknown => {
		if (name in nodeParameters) return nodeParameters[name];
		const parts = name.split('.');
		let current: unknown = nodeParameters;
		for (const part of parts) {
			if (current === null || current === undefined || typeof current !== 'object') {
				return undefined;
			}
			current = Array.isArray(current)
				? (current as unknown[])[Number(part)]
				: (current as Record<string, unknown>)[part];
		}
		return current;
	};

	const context = {
		getInputData: (inputIndex = 0): INodeExecutionData[] => {
			if (unconnectedInputs.includes(inputIndex)) {
				throw new Error(`Input ${inputIndex} is not connected`);
			}
			return (inputs[inputIndex] ?? []) as unknown as INodeExecutionData[];
		},
		getNodeParameter: (name: string, itemIndex: number, defaultValue?: unknown): unknown => {
			const evaluator = expressions[name];
			if (evaluator) return evaluator(itemIndex);
			const value = readParameter(name);
			return value !== undefined ? value : defaultValue;
		},
		evaluateExpression: (expression: string, itemIndex: number): unknown => {
			// Faithful to n8n: `evaluateExpression` prefixes the string with `=` itself. Tests
			// therefore declare their expressions in the form stored in the workflow (`={{ … }}`),
			// and the code under test must pass the form WITHOUT the prefix — otherwise n8n returns "=value".
			const evaluator = expressions[`=${expression}`];
			return evaluator ? evaluator(itemIndex) : `=${expression}`;
		},
		getNode: () => ({
			name: nodeName,
			type: 'test.formatTemplate',
			typeVersion,
			parameters: nodeParameters,
		}),
		getWorkflow: () => ({ id: 'wf-test', name: 'Test workflow' }),
		getExecutionId: () => 'exec-test-1',
		continueOnFail: () => continueOnFail,
		helpers: { httpRequest },
		logger: {
			debug: (msg: string) => logs.debug.push(msg),
			info: (msg: string) => logs.info.push(msg),
			warn: (msg: string) => logs.warn.push(msg),
			error: (msg: string) => logs.error.push(msg),
		},
	} as unknown as IExecuteFunctions;

	return { context, logs };
}
