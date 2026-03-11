import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { listNamespacesTool } from '../../src/tools/infrastructure/namespace-list.ts';

function createMockClient(response: Record<string, unknown> = { namespaces: [] }) {
	const grpcFn = mock(() => Promise.resolve(response));
	return {
		client: {
			workflowService: { listNamespaces: grpcFn },
		} as unknown as Client,
		grpcFn,
	};
}

describe('listNamespacesTool', () => {
	test('delegates to grpc listNamespaces', async () => {
		const { client, grpcFn } = createMockClient();
		await listNamespacesTool(client, { pageSize: 50 });

		expect(grpcFn).toHaveBeenCalledWith({ pageSize: 50 });
	});

	test('returns namespace list', async () => {
		const { client } = createMockClient({
			namespaces: [
				{
					namespaceInfo: {
						name: 'default',
						state: 'NAMESPACE_STATE_REGISTERED',
						description: 'Default namespace',
						ownerEmail: 'admin@example.com',
					},
					config: {
						workflowExecutionRetentionTtl: { seconds: 259200 },
					},
				},
			],
		});

		const result = await listNamespacesTool(client, {});
		expect(result.namespaces).toHaveLength(1);
		expect(result.namespaces[0]!.name).toBe('default');
		expect(result.namespaces[0]!.retentionDays).toBe(3);
	});

	test('returns empty list when no namespaces', async () => {
		const { client } = createMockClient();
		const result = await listNamespacesTool(client, {});
		expect(result.namespaces).toEqual([]);
	});
});
