import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { getTaskReachability } from '../../src/tools/worker/task-reachability.ts';

function createMockClient(response: Record<string, unknown> = {}) {
	const grpcFn = mock(() => Promise.resolve(response));
	return {
		client: {
			workflowService: { getWorkerTaskReachability: grpcFn },
		} as unknown as Client,
		grpcFn,
	};
}

describe('getTaskReachability', () => {
	test('calls grpc getWorkerTaskReachability with correct params', async () => {
		const { client, grpcFn } = createMockClient({ buildIdReachability: [] });
		await getTaskReachability(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
			buildIds: ['v1', 'v2'],
		});

		expect(grpcFn).toHaveBeenCalledWith({
			namespace: 'default',
			buildIds: ['v1', 'v2'],
			taskQueues: ['my-queue'],
		});
	});

	test('defaults buildIds to empty array', async () => {
		const { client, grpcFn } = createMockClient({ buildIdReachability: [] });
		await getTaskReachability(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(grpcFn).toHaveBeenCalledWith({
			namespace: 'default',
			buildIds: [],
			taskQueues: ['my-queue'],
		});
	});

	test('maps reachability response', async () => {
		const { client } = createMockClient({
			buildIdReachability: [
				{
					buildId: 'v1',
					taskQueueReachability: [
						{
							taskQueue: 'my-queue',
							reachability: ['REACHABILITY_REACHABLE'],
						},
					],
				},
			],
		});

		const result = (await getTaskReachability(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		})) as any;
		expect(result.buildIdReachability).toHaveLength(1);
		expect(result.buildIdReachability[0].buildId).toBe('v1');
		expect(result.buildIdReachability[0].taskQueueReachability).toHaveLength(1);
		expect(result.buildIdReachability[0].taskQueueReachability[0].taskQueue).toBe('my-queue');
		expect(result.buildIdReachability[0].taskQueueReachability[0].reachability).toEqual(['REACHABILITY_REACHABLE']);
	});

	test('handles empty reachability response', async () => {
		const { client } = createMockClient({ buildIdReachability: [] });
		const result = (await getTaskReachability(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		})) as any;
		expect(result.buildIdReachability).toEqual([]);
	});
});
