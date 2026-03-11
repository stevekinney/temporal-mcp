import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { getClusterInfo } from '../../src/tools/infrastructure/cluster-info.ts';

function createMockClient(response: Record<string, unknown> = {}) {
	const grpcFn = mock(() => Promise.resolve(response));
	return {
		client: {
			workflowService: { getSystemInfo: grpcFn },
		} as unknown as Client,
		grpcFn,
	};
}

describe('getClusterInfo', () => {
	test('delegates to grpc getSystemInfo', async () => {
		const { client, grpcFn } = createMockClient();
		await getClusterInfo(client);

		expect(grpcFn).toHaveBeenCalledWith({});
	});

	test('returns server version and capabilities', async () => {
		const { client } = createMockClient({
			serverVersion: '1.24.0',
			capabilities: {
				signalAndQueryHeader: true,
				supportsSchedules: true,
				buildIdBasedVersioning: true,
			},
		});

		const result = await getClusterInfo(client);
		expect(result.serverVersion).toBe('1.24.0');
		expect(result.capabilities.supportsSchedules).toBe(true);
		expect(result.capabilities.buildIdBasedVersioning).toBe(true);
	});

	test('handles empty response', async () => {
		const { client } = createMockClient();
		const result = await getClusterInfo(client);
		expect(result.serverVersion).toBe('');
		expect(result.capabilities.supportsSchedules).toBe(false);
	});
});
