import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { describeTaskQueueTool } from '../../src/tools/infrastructure/task-queue-describe.ts';

function createMockClient(response: Record<string, unknown> = {}) {
	const grpcFn = mock(() => Promise.resolve(response));
	return {
		client: {
			workflowService: { describeTaskQueue: grpcFn },
		} as unknown as Client,
		grpcFn,
	};
}

describe('describeTaskQueueTool', () => {
	test('delegates to grpc describeTaskQueue', async () => {
		const { client, grpcFn } = createMockClient({});
		await describeTaskQueueTool(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(grpcFn).toHaveBeenCalledWith({
			namespace: 'default',
			taskQueue: { name: 'my-queue' },
			taskQueueType: 1,
			includeTaskQueueStatus: true,
		});
	});

	test('returns mapped task queue description', async () => {
		const { client } = createMockClient({
			pollers: [
				{
					identity: 'worker-1',
					ratePerSecond: 100,
				},
			],
			taskQueueStatus: {
				backlogCountHint: 5,
				readLevel: 10,
				ackLevel: 8,
				taskIdBlock: 20,
			},
		});

		const result = await describeTaskQueueTool(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(result.taskQueue).toBe('my-queue');
		expect(result.pollers).toHaveLength(1);
		expect(result.pollers[0]!.identity).toBe('worker-1');
		expect(result.taskQueueStatus).not.toBeNull();
		expect(result.taskQueueStatus!.backlogCountHint).toBe(5);
	});

	test('passes custom taskQueueType', async () => {
		const { client, grpcFn } = createMockClient({});
		await describeTaskQueueTool(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
			taskQueueType: 2,
		});

		expect(grpcFn).toHaveBeenCalledWith(
			expect.objectContaining({ taskQueueType: 2 }),
		);
	});
});
