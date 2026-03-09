import { describe, expect, mock, test } from 'bun:test';
import { createServer } from '../../src/server.ts';
import { TemporalConnectionManager } from '../../../temporal/src/connection.ts';
import { registerTemporalTools } from '../../src/tools/register.ts';
import type { TemporalConfig } from '../../src/contracts/config.ts';

const config: TemporalConfig = {
	defaultProfile: 'test',
	profiles: {
		test: {
			kind: 'self-hosted',
			address: 'localhost:7233',
			namespace: 'default',
		},
	},
};

describe('registerTemporalTools', () => {
	test('registers two tools on the server', () => {
		const server = createServer();
		const manager = new TemporalConnectionManager(config);
		registerTemporalTools(server, manager);
	});
});

describe('registerTemporalTools — handler behavior', () => {
	type ToolCallback = (args: Record<string, unknown>) => Promise<unknown>;

	function setup() {
		const handlers = new Map<string, ToolCallback>();
		const fakeServer = {
			registerTool(
				name: string,
				_config: unknown,
				callback: ToolCallback,
			) {
				handlers.set(name, callback);
			},
		};

		const getClient = mock();
		const fakeConnectionManager = { getClient } as unknown as TemporalConnectionManager;

		registerTemporalTools(fakeServer as any, fakeConnectionManager);

		return { handlers, getClient };
	}

	test('registers exactly the two expected tool names', () => {
		const { handlers } = setup();
		const names = [...handlers.keys()].sort();
		expect(names).toEqual([
			'temporal.workflow.describe',
			'temporal.workflow.list',
		]);
	});

	describe('temporal.workflow.list handler', () => {
		test('returns success envelope with workflow data', async () => {
			const { handlers, getClient } = setup();
			const mockWorkflows = [
				{
					workflowId: 'wf-1',
					runId: 'run-1',
					type: 'TestWorkflow',
					status: { name: 'RUNNING' },
					startTime: new Date('2026-01-01T00:00:00Z'),
					closeTime: null,
				},
			];

			getClient.mockResolvedValue({
				workflow: {
					list: () =>
						(async function* () {
							for (const w of mockWorkflows) yield w;
						})(),
				},
			});

			const handler = handlers.get('temporal.workflow.list')!;
			const result = (await handler({
				pageSize: 10,
			})) as any;

			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.ok).toBe(true);
			expect(parsed.data).toHaveLength(1);
			expect(parsed.data[0].workflowId).toBe('wf-1');
		});

		test('passes profile to connectionManager.getClient()', async () => {
			const { handlers, getClient } = setup();
			getClient.mockResolvedValue({
				workflow: {
					list: () => (async function* () {})(),
				},
			});

			const handler = handlers.get('temporal.workflow.list')!;
			await handler({ profile: 'production', pageSize: 10 });

			expect(getClient).toHaveBeenCalledWith('production');
		});

		test('returns error envelope when getClient throws an ErrorEnvelope', async () => {
			const { handlers, getClient } = setup();
			const errorEnvelope = {
				ok: false,
				error: {
					code: 'PROFILE_NOT_FOUND',
					message: 'Profile "missing" not found.',
					retryable: false,
				},
			};
			getClient.mockRejectedValue(errorEnvelope);

			const handler = handlers.get('temporal.workflow.list')!;
			const result = (await handler({
				profile: 'missing',
				pageSize: 10,
			})) as any;

			expect(result.isError).toBe(true);
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.ok).toBe(false);
			expect(parsed.error.code).toBe('PROFILE_NOT_FOUND');
		});

		test('wraps Error instances in INTERNAL_ERROR envelope', async () => {
			const { handlers, getClient } = setup();
			getClient.mockRejectedValue(new Error('Connection refused'));

			const handler = handlers.get('temporal.workflow.list')!;
			const result = (await handler({ pageSize: 10 })) as any;

			expect(result.isError).toBe(true);
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.ok).toBe(false);
			expect(parsed.error.code).toBe('INTERNAL_ERROR');
			expect(parsed.error.message).toBe('Connection refused');
		});

		test('wraps non-Error throws with generic message', async () => {
			const { handlers, getClient } = setup();
			getClient.mockRejectedValue('string-error');

			const handler = handlers.get('temporal.workflow.list')!;
			const result = (await handler({ pageSize: 10 })) as any;

			expect(result.isError).toBe(true);
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.ok).toBe(false);
			expect(parsed.error.code).toBe('INTERNAL_ERROR');
			expect(parsed.error.message).toBe('An unknown error occurred');
		});
	});

	describe('temporal.workflow.describe handler', () => {
		test('returns success envelope with description data', async () => {
			const { handlers, getClient } = setup();
			getClient.mockResolvedValue({
				workflow: {
					getHandle: () => ({
						describe: async () => ({
							workflowId: 'wf-1',
							runId: 'run-1',
							type: 'TestWorkflow',
							status: { name: 'COMPLETED' },
							taskQueue: 'default',
							startTime: new Date('2026-01-01T00:00:00Z'),
							closeTime: new Date('2026-01-01T01:00:00Z'),
							executionTime: new Date('2026-01-01T00:00:01Z'),
							historyLength: 10,
							memo: {},
							searchAttributes: {},
							parentExecution: null,
						}),
					}),
				},
			});

			const handler = handlers.get('temporal.workflow.describe')!;
			const result = (await handler({
				workflowId: 'wf-1',
			})) as any;

			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.ok).toBe(true);
			expect(parsed.data.workflowId).toBe('wf-1');
			expect(parsed.data.status).toBe('COMPLETED');
		});

		test('returns error envelope on failure', async () => {
			const { handlers, getClient } = setup();
			getClient.mockRejectedValue(new Error('not found'));

			const handler = handlers.get('temporal.workflow.describe')!;
			const result = (await handler({
				workflowId: 'wf-missing',
			})) as any;

			expect(result.isError).toBe(true);
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.ok).toBe(false);
			expect(parsed.error.code).toBe('INTERNAL_ERROR');
			expect(parsed.error.message).toBe('not found');
		});
	});
});
