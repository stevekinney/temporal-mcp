import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import {
	listWorkerDeployments,
	describeWorkerDeployment,
	describeWorkerDeploymentVersion,
	getDeploymentReachability,
} from '../../src/tools/worker/deployment.ts';

function createMockClient(overrides: Record<string, any> = {}) {
	return {
		workflowService: {
			listWorkerDeployments: mock(() => Promise.resolve({ workerDeployments: [] })),
			describeWorkerDeployment: mock(() => Promise.resolve({})),
			describeWorkerDeploymentVersion: mock(() => Promise.resolve({})),
			getDeploymentReachability: mock(() => Promise.resolve({})),
			...overrides,
		},
	} as unknown as Client;
}

describe('listWorkerDeployments', () => {
	test('delegates to grpc and returns deployment list', async () => {
		const client = createMockClient({
			listWorkerDeployments: mock(() =>
				Promise.resolve({
					workerDeployments: [
						{ name: 'deploy-1', createTime: { seconds: 1700000000 } },
					],
				}),
			),
		});

		const result = await listWorkerDeployments(client, { namespace: 'default' });
		expect(result.deployments).toHaveLength(1);
		expect(result.deployments[0]!.name).toBe('deploy-1');
	});

	test('handles empty deployment list', async () => {
		const client = createMockClient();
		const result = await listWorkerDeployments(client, { namespace: 'default' });
		expect(result.deployments).toEqual([]);
	});
});

describe('describeWorkerDeployment', () => {
	test('delegates to grpc and returns deployment description', async () => {
		const client = createMockClient({
			describeWorkerDeployment: mock(() =>
				Promise.resolve({
					workerDeploymentInfo: {
						name: 'deploy-1',
						createTime: { seconds: 1700000000 },
						currentVersion: { buildId: 'v2', createTime: { seconds: 1700000100 } },
						rampingVersion: null,
					},
				}),
			),
		});

		const result = await describeWorkerDeployment(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
		});
		expect(result.name).toBe('deploy-1');
		expect(result.currentVersion).not.toBeNull();
		expect(result.currentVersion!.buildId).toBe('v2');
	});

	test('handles empty deployment description', async () => {
		const client = createMockClient();
		const result = await describeWorkerDeployment(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
		});
		expect(result.name).toBe('deploy-1');
		expect(result.currentVersion).toBeNull();
	});
});

describe('describeWorkerDeploymentVersion', () => {
	test('delegates to grpc and returns version description', async () => {
		const client = createMockClient({
			describeWorkerDeploymentVersion: mock(() =>
				Promise.resolve({
					workerDeploymentVersionInfo: {
						deploymentName: 'deploy-1',
						buildId: 'v2',
						createTime: { seconds: 1700000000 },
						taskQueues: [{ name: 'queue-1', taskQueueType: 'TASK_QUEUE_TYPE_WORKFLOW' }],
						drainageState: 'DRAINAGE_STATE_DRAINED',
					},
				}),
			),
		});

		const result = await describeWorkerDeploymentVersion(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
			buildId: 'v2',
		});
		expect(result.deploymentName).toBe('deploy-1');
		expect(result.buildId).toBe('v2');
		expect(result.taskQueues).toHaveLength(1);
		expect(result.drainageState).toBe('DRAINAGE_STATE_DRAINED');
	});

	test('handles empty version description', async () => {
		const client = createMockClient();
		const result = await describeWorkerDeploymentVersion(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
			buildId: 'v2',
		});
		expect(result.deploymentName).toBe('deploy-1');
		expect(result.buildId).toBe('v2');
		expect(result.taskQueues).toEqual([]);
	});
});

describe('getDeploymentReachability', () => {
	test('delegates to grpc and returns reachability info', async () => {
		const client = createMockClient({
			getDeploymentReachability: mock(() =>
				Promise.resolve({
					entries: [
						{
							buildId: 'v2',
							taskQueueReachability: [
								{ taskQueue: 'queue-1', reachability: ['REACHABILITY_REACHABLE'] },
							],
						},
					],
				}),
			),
		});

		const result = await getDeploymentReachability(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
		});
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]!.buildId).toBe('v2');
	});

	test('handles empty reachability response', async () => {
		const client = createMockClient();
		const result = await getDeploymentReachability(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
		});
		expect(result.entries).toEqual([]);
	});
});
