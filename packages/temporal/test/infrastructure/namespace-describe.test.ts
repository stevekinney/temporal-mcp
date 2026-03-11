import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { describeNamespaceTool } from '../../src/tools/infrastructure/namespace-describe.ts';

function createMockClient(response: Record<string, unknown> = {}) {
	const grpcFn = mock(() => Promise.resolve(response));
	return {
		client: {
			workflowService: { describeNamespace: grpcFn },
		} as unknown as Client,
		grpcFn,
	};
}

describe('describeNamespaceTool', () => {
	test('delegates to grpc describeNamespace', async () => {
		const { client, grpcFn } = createMockClient();
		await describeNamespaceTool(client, { namespace: 'default' });

		expect(grpcFn).toHaveBeenCalledWith({ namespace: 'default' });
	});

	test('returns namespace description', async () => {
		const { client } = createMockClient({
			namespaceInfo: {
				name: 'production',
				state: 'NAMESPACE_STATE_REGISTERED',
				description: 'Production namespace',
				ownerEmail: 'ops@example.com',
			},
			config: {
				workflowExecutionRetentionTtl: { seconds: 604800 },
				historyArchivalState: 'ARCHIVAL_STATE_ENABLED',
				visibilityArchivalState: 'ARCHIVAL_STATE_DISABLED',
			},
			replicationConfig: {
				activeClusterName: 'us-west-2',
				clusters: [{ clusterName: 'us-west-2' }],
			},
		});

		const result = await describeNamespaceTool(client, { namespace: 'production' });
		expect(result.name).toBe('production');
		expect(result.retentionDays).toBe(7);
		expect(result.activeClusterName).toBe('us-west-2');
	});

	test('handles empty response with defaults', async () => {
		const { client } = createMockClient();
		const result = await describeNamespaceTool(client, { namespace: 'empty' });
		expect(result.name).toBe('');
		expect(result.state).toBe('NAMESPACE_STATE_UNSPECIFIED');
		expect(result.retentionDays).toBe(0);
	});
});
