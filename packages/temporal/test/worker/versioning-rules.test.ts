import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { getVersioningRules } from '../../src/tools/worker/versioning-rules.ts';

function createMockClient(response: Record<string, unknown> = {}) {
	const grpcFn = mock(() => Promise.resolve(response));
	return {
		client: {
			workflowService: { getWorkerVersioningRules: grpcFn },
		} as unknown as Client,
		grpcFn,
	};
}

describe('getVersioningRules', () => {
	test('delegates to grpc getWorkerVersioningRules', async () => {
		const { client, grpcFn } = createMockClient();
		await getVersioningRules(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(grpcFn).toHaveBeenCalledWith({
			namespace: 'default',
			taskQueue: 'my-queue',
		});
	});

	test('returns assignment and redirect rules', async () => {
		const { client } = createMockClient({
			assignmentRules: [
				{
					rule: { targetBuildId: 'v2', percentageRamp: { rampPercentage: 50 } },
					createTime: { seconds: 1700000000 },
				},
			],
			redirectRules: [
				{
					rule: { sourceBuildId: 'v1', targetBuildId: 'v2' },
					createTime: { seconds: 1700000000 },
				},
			],
			conflictToken: 'token-1',
		});

		const result = await getVersioningRules(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(result.assignmentRules).toHaveLength(1);
		expect(result.assignmentRules[0]!.targetBuildId).toBe('v2');
		expect(result.assignmentRules[0]!.percentageRamp).toBe(50);
		expect(result.redirectRules).toHaveLength(1);
		expect(result.redirectRules[0]!.sourceBuildId).toBe('v1');
		expect(result.conflictToken).toBe('token-1');
	});

	test('handles empty versioning rules', async () => {
		const { client } = createMockClient();
		const result = await getVersioningRules(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(result.assignmentRules).toEqual([]);
		expect(result.redirectRules).toEqual([]);
		expect(result.conflictToken).toBeNull();
	});
});
