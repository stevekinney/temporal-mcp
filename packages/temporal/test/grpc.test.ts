import { describe, expect, mock, test } from 'bun:test';
import {
	describeTaskQueue,
	getTaskQueueConfiguration,
	listNamespaces,
	describeNamespace,
	listSearchAttributes,
	getSystemInfo,
	getWorkerVersioningRules,
	getWorkflowExecutionHistoryReverse,
	listScheduleMatchingTimes,
	listWorkerDeployments,
	describeWorkerDeployment,
	describeWorkerDeploymentVersion,
	getDeploymentReachability,
} from '../src/grpc.ts';

function createMockClient(overrides: Record<string, any> = {}) {
	return {
		workflowService: {
			describeTaskQueue: mock(() => Promise.resolve({})),
			listNamespaces: mock(() =>
				Promise.resolve({ namespaces: [] }),
			),
			describeNamespace: mock(() => Promise.resolve({})),
			getSystemInfo: mock(() => Promise.resolve({})),
			getWorkerVersioningRules: mock(() => Promise.resolve({})),
			getWorkflowExecutionHistory: mock(() =>
				Promise.resolve({ history: { events: [] } }),
			),
			listScheduleMatchingTimes: mock(() =>
				Promise.resolve({ startTime: [] }),
			),
			listWorkerDeployments: mock(() =>
				Promise.resolve({ workerDeployments: [] }),
			),
			describeWorkerDeployment: mock(() => Promise.resolve({})),
			describeWorkerDeploymentVersion: mock(() =>
				Promise.resolve({}),
			),
			getDeploymentReachability: mock(() => Promise.resolve({})),
			...overrides.workflowService,
		},
		connection: {
			operatorService: {
				listSearchAttributes: mock(() =>
					Promise.resolve({
						customAttributes: {},
						systemAttributes: {},
					}),
				),
				...overrides.operatorService,
			},
		},
	} as any;
}

// --- describeTaskQueue ---

describe('describeTaskQueue', () => {
	test('calls workflowService.describeTaskQueue with correct request', async () => {
		const client = createMockClient();
		await describeTaskQueue(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(
			client.workflowService.describeTaskQueue,
		).toHaveBeenCalledWith({
			namespace: 'default',
			taskQueue: { name: 'my-queue' },
			taskQueueType: 1,
			includeTaskQueueStatus: true,
		});
	});

	test('maps pollers and status from proto response', async () => {
		const client = createMockClient({
			workflowService: {
				describeTaskQueue: mock(() =>
					Promise.resolve({
						pollers: [
							{
								lastAccessTime: { seconds: 1700000000 },
								identity: 'worker-1',
								ratePerSecond: 100,
								workerVersionCapabilities: {
									buildId: 'v1',
								},
							},
							{
								identity: 'worker-2',
							},
						],
						taskQueueStatus: {
							backlogCountHint: 42,
							readLevel: 100,
							ackLevel: 98,
							taskIdBlock: 200,
						},
					}),
				),
			},
		});

		const result = await describeTaskQueue(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(result.taskQueue).toBe('my-queue');
		expect(result.pollers).toHaveLength(2);
		expect(result.pollers[0]!.identity).toBe('worker-1');
		expect(result.pollers[0]!.ratePerSecond).toBe(100);
		expect(result.pollers[0]!.lastAccessTime).toBeTypeOf('string');
		expect(result.pollers[0]!.workerVersionCapabilities).toEqual({
			buildId: 'v1',
		});
		expect(result.pollers[1]!.identity).toBe('worker-2');
		expect(result.pollers[1]!.lastAccessTime).toBeNull();
		expect(result.pollers[1]!.ratePerSecond).toBe(0);
		expect(result.taskQueueStatus).toEqual({
			backlogCountHint: 42,
			readLevel: 100,
			ackLevel: 98,
			taskIdBlock: 200,
		});
	});

	test('handles empty proto response gracefully', async () => {
		const client = createMockClient();
		const result = await describeTaskQueue(client, {
			namespace: 'default',
			taskQueue: 'empty-queue',
		});

		expect(result.taskQueue).toBe('empty-queue');
		expect(result.pollers).toEqual([]);
		expect(result.taskQueueStatus).toBeNull();
	});

	test('respects custom taskQueueType parameter', async () => {
		const client = createMockClient();
		await describeTaskQueue(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
			taskQueueType: 2,
		});

		expect(
			client.workflowService.describeTaskQueue,
		).toHaveBeenCalledWith(
			expect.objectContaining({ taskQueueType: 2 }),
		);
	});
});

// --- getTaskQueueConfiguration ---

describe('getTaskQueueConfiguration', () => {
	test('calls describeTaskQueue with includeTaskQueueStatus false', async () => {
		const client = createMockClient();
		await getTaskQueueConfiguration(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(
			client.workflowService.describeTaskQueue,
		).toHaveBeenCalledWith({
			namespace: 'default',
			taskQueue: { name: 'my-queue' },
			taskQueueType: 1,
			includeTaskQueueStatus: false,
		});
	});

	test('maps configuration fields from response', async () => {
		const client = createMockClient({
			workflowService: {
				describeTaskQueue: mock(() =>
					Promise.resolve({
						maxTasksPerSecond: 500,
						pollerConfiguration: {
							maximumPollersCount: 10,
						},
					}),
				),
			},
		});

		const result = await getTaskQueueConfiguration(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(result.taskQueue).toBe('my-queue');
		expect(result.maxTasksPerSecond).toBe(500);
		expect(result.pollerConfiguration).toEqual({
			maximumPollersCount: 10,
		});
	});

	test('preserves zero-valued configuration fields', async () => {
		const client = createMockClient({
			workflowService: {
				describeTaskQueue: mock(() =>
					Promise.resolve({
						maxTasksPerSecond: 0,
						pollerConfiguration: {
							maximumPollersCount: 0,
						},
					}),
				),
			},
		});

		const result = await getTaskQueueConfiguration(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(result.maxTasksPerSecond).toBe(0);
		expect(result.pollerConfiguration).toEqual({
			maximumPollersCount: 0,
		});
	});

	test('handles missing configuration gracefully', async () => {
		const client = createMockClient();
		const result = await getTaskQueueConfiguration(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(result.maxTasksPerSecond).toBeNull();
		expect(result.pollerConfiguration).toBeNull();
	});
});

// --- listNamespaces ---

describe('listNamespaces', () => {
	test('calls workflowService.listNamespaces with page size', async () => {
		const client = createMockClient();
		await listNamespaces(client, { pageSize: 50 });

		expect(
			client.workflowService.listNamespaces,
		).toHaveBeenCalledWith({ pageSize: 50 });
	});

	test('defaults pageSize to 100', async () => {
		const client = createMockClient();
		await listNamespaces(client);

		expect(
			client.workflowService.listNamespaces,
		).toHaveBeenCalledWith({ pageSize: 100 });
	});

	test('maps namespace list from proto response', async () => {
		const client = createMockClient({
			workflowService: {
				listNamespaces: mock(() =>
					Promise.resolve({
						namespaces: [
							{
								namespaceInfo: {
									name: 'default',
									state: 'NAMESPACE_STATE_REGISTERED',
									description: 'Default namespace',
									ownerEmail: 'admin@example.com',
								},
								config: {
									workflowExecutionRetentionTtl: {
										seconds: 259200,
									},
								},
							},
							{
								namespaceInfo: {
									name: 'production',
									state: 'NAMESPACE_STATE_REGISTERED',
								},
								config: {},
							},
						],
					}),
				),
			},
		});

		const result = await listNamespaces(client);

		expect(result.namespaces).toHaveLength(2);
		expect(result.namespaces[0]!.name).toBe('default');
		expect(result.namespaces[0]!.state).toBe(
			'NAMESPACE_STATE_REGISTERED',
		);
		expect(result.namespaces[0]!.description).toBe(
			'Default namespace',
		);
		expect(result.namespaces[0]!.ownerEmail).toBe(
			'admin@example.com',
		);
		expect(result.namespaces[0]!.retentionDays).toBe(3);
		expect(result.namespaces[1]!.name).toBe('production');
		expect(result.namespaces[1]!.retentionDays).toBe(0);
	});

	test('returns empty list for empty response', async () => {
		const client = createMockClient();
		const result = await listNamespaces(client);

		expect(result.namespaces).toEqual([]);
	});
});

// --- describeNamespace ---

describe('describeNamespace', () => {
	test('calls workflowService.describeNamespace with correct params', async () => {
		const client = createMockClient();
		await describeNamespace(client, { namespace: 'default' });

		expect(
			client.workflowService.describeNamespace,
		).toHaveBeenCalledWith({ namespace: 'default' });
	});

	test('maps all namespace description fields', async () => {
		const client = createMockClient({
			workflowService: {
				describeNamespace: mock(() =>
					Promise.resolve({
						namespaceInfo: {
							name: 'production',
							state: 'NAMESPACE_STATE_REGISTERED',
							description: 'Production namespace',
							ownerEmail: 'ops@example.com',
						},
						config: {
							workflowExecutionRetentionTtl: {
								seconds: 604800,
							},
							historyArchivalState:
								'ARCHIVAL_STATE_ENABLED',
							visibilityArchivalState:
								'ARCHIVAL_STATE_DISABLED',
						},
						replicationConfig: {
							activeClusterName: 'us-west-2',
							clusters: [
								{ clusterName: 'us-west-2' },
								{ clusterName: 'us-east-1' },
							],
						},
					}),
				),
			},
		});

		const result = await describeNamespace(client, {
			namespace: 'production',
		});

		expect(result.name).toBe('production');
		expect(result.state).toBe('NAMESPACE_STATE_REGISTERED');
		expect(result.description).toBe('Production namespace');
		expect(result.ownerEmail).toBe('ops@example.com');
		expect(result.retentionDays).toBe(7);
		expect(result.activeClusterName).toBe('us-west-2');
		expect(result.clusters).toEqual(['us-west-2', 'us-east-1']);
		expect(result.historyArchivalState).toBe(
			'ARCHIVAL_STATE_ENABLED',
		);
		expect(result.visibilityArchivalState).toBe(
			'ARCHIVAL_STATE_DISABLED',
		);
	});

	test('handles empty proto response with defaults', async () => {
		const client = createMockClient();
		const result = await describeNamespace(client, {
			namespace: 'empty',
		});

		expect(result.name).toBe('');
		expect(result.state).toBe('NAMESPACE_STATE_UNSPECIFIED');
		expect(result.retentionDays).toBe(0);
		expect(result.activeClusterName).toBe('');
		expect(result.clusters).toEqual([]);
		expect(result.historyArchivalState).toBe(
			'ARCHIVAL_STATE_UNSPECIFIED',
		);
		expect(result.visibilityArchivalState).toBe(
			'ARCHIVAL_STATE_UNSPECIFIED',
		);
	});
});

// --- listSearchAttributes ---

describe('listSearchAttributes', () => {
	test('calls operatorService.listSearchAttributes', async () => {
		const client = createMockClient();
		await listSearchAttributes(client, { namespace: 'default' });

		expect(
			client.connection.operatorService.listSearchAttributes,
		).toHaveBeenCalledWith({ namespace: 'default' });
	});

	test('maps custom and system attributes', async () => {
		const client = createMockClient({
			operatorService: {
				listSearchAttributes: mock(() =>
					Promise.resolve({
						customAttributes: {
							CustomField: 'INDEXED_VALUE_TYPE_KEYWORD',
							Score: 'INDEXED_VALUE_TYPE_INT',
						},
						systemAttributes: {
							WorkflowId:
								'INDEXED_VALUE_TYPE_KEYWORD',
							StartTime:
								'INDEXED_VALUE_TYPE_DATETIME',
						},
					}),
				),
			},
		});

		const result = await listSearchAttributes(client, {
			namespace: 'default',
		});

		expect(result.customAttributes).toEqual({
			CustomField: 'INDEXED_VALUE_TYPE_KEYWORD',
			Score: 'INDEXED_VALUE_TYPE_INT',
		});
		expect(result.systemAttributes).toEqual({
			WorkflowId: 'INDEXED_VALUE_TYPE_KEYWORD',
			StartTime: 'INDEXED_VALUE_TYPE_DATETIME',
		});
	});

	test('handles null attributes gracefully', async () => {
		const client = createMockClient({
			operatorService: {
				listSearchAttributes: mock(() =>
					Promise.resolve({
						customAttributes: null,
						systemAttributes: undefined,
					}),
				),
			},
		});

		const result = await listSearchAttributes(client, {
			namespace: 'default',
		});

		expect(result.customAttributes).toEqual({});
		expect(result.systemAttributes).toEqual({});
	});
});

// --- getSystemInfo ---

describe('getSystemInfo', () => {
	test('calls workflowService.getSystemInfo', async () => {
		const client = createMockClient();
		await getSystemInfo(client);

		expect(
			client.workflowService.getSystemInfo,
		).toHaveBeenCalledWith({});
	});

	test('maps server version and capabilities', async () => {
		const client = createMockClient({
			workflowService: {
				getSystemInfo: mock(() =>
					Promise.resolve({
						serverVersion: '1.24.0',
						capabilities: {
							signalAndQueryHeader: true,
							internalErrorDifferentiation: true,
							activityFailureIncludeHeartbeat: false,
							supportsSchedules: true,
							encodedFailureAttributes: true,
							buildIdBasedVersioning: true,
							upsertMemo: true,
							eagerWorkflowStart: true,
							sdkMetadata: true,
							countGroupByExecutionStatus: true,
						},
					}),
				),
			},
		});

		const result = await getSystemInfo(client);

		expect(result.serverVersion).toBe('1.24.0');
		expect(result.capabilities.supportsSchedules).toBe(true);
		expect(result.capabilities.buildIdBasedVersioning).toBe(true);
		expect(
			result.capabilities.activityFailureIncludeHeartbeat,
		).toBe(false);
		expect(result.capabilities.eagerWorkflowStart).toBe(true);
	});

	test('handles empty system info response', async () => {
		const client = createMockClient();
		const result = await getSystemInfo(client);

		expect(result.serverVersion).toBe('');
		expect(result.capabilities.signalAndQueryHeader).toBe(false);
		expect(result.capabilities.supportsSchedules).toBe(false);
		expect(result.capabilities.buildIdBasedVersioning).toBe(false);
	});
});

// --- getWorkerVersioningRules ---

describe('getWorkerVersioningRules', () => {
	test('calls workflowService.getWorkerVersioningRules', async () => {
		const client = createMockClient();
		await getWorkerVersioningRules(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(
			client.workflowService.getWorkerVersioningRules,
		).toHaveBeenCalledWith({
			namespace: 'default',
			taskQueue: 'my-queue',
		});
	});

	test('maps assignment and redirect rules', async () => {
		const client = createMockClient({
			workflowService: {
				getWorkerVersioningRules: mock(() =>
					Promise.resolve({
						assignmentRules: [
							{
								rule: {
									targetBuildId: 'v2',
									percentageRamp: {
										rampPercentage: 50,
									},
								},
								createTime: { seconds: 1700000000 },
							},
						],
						redirectRules: [
							{
								rule: {
									sourceBuildId: 'v1',
									targetBuildId: 'v2',
								},
								createTime: { seconds: 1700000000 },
							},
						],
						conflictToken: 'abc123',
					}),
				),
			},
		});

		const result = await getWorkerVersioningRules(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(result.assignmentRules).toHaveLength(1);
		expect(result.assignmentRules[0]!.targetBuildId).toBe('v2');
		expect(result.assignmentRules[0]!.percentageRamp).toBe(50);
		expect(result.assignmentRules[0]!.createTime).toBeTypeOf(
			'string',
		);
		expect(result.redirectRules).toHaveLength(1);
		expect(result.redirectRules[0]!.sourceBuildId).toBe('v1');
		expect(result.redirectRules[0]!.targetBuildId).toBe('v2');
		expect(result.conflictToken).toBe('abc123');
	});

	test('preserves a zero ramp percentage', async () => {
		const client = createMockClient({
			workflowService: {
				getWorkerVersioningRules: mock(() =>
					Promise.resolve({
						assignmentRules: [
							{
								rule: {
									targetBuildId: 'v2',
									percentageRamp: {
										rampPercentage: 0,
									},
								},
							},
						],
					}),
				),
			},
		});

		const result = await getWorkerVersioningRules(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(result.assignmentRules[0]!.percentageRamp).toBe(0);
	});

	test('handles empty versioning rules', async () => {
		const client = createMockClient();
		const result = await getWorkerVersioningRules(client, {
			namespace: 'default',
			taskQueue: 'my-queue',
		});

		expect(result.assignmentRules).toEqual([]);
		expect(result.redirectRules).toEqual([]);
		expect(result.conflictToken).toBeNull();
	});
});

// --- getWorkflowExecutionHistoryReverse ---

describe('getWorkflowExecutionHistoryReverse', () => {
	test('calls getWorkflowExecutionHistory with reverseOrder', async () => {
		const client = createMockClient();
		await getWorkflowExecutionHistoryReverse(client, {
			namespace: 'default',
			workflowId: 'wf-1',
			runId: 'run-1',
		});

		expect(
			client.workflowService.getWorkflowExecutionHistory,
		).toHaveBeenCalledWith({
			namespace: 'default',
			execution: { workflowId: 'wf-1', runId: 'run-1' },
			maximumPageSize: 100,
			reverseOrder: true,
		});
	});

	test('maps history events from proto response', async () => {
		const client = createMockClient({
			workflowService: {
				getWorkflowExecutionHistory: mock(() =>
					Promise.resolve({
						history: {
							events: [
								{
									eventId: 1,
									eventType:
										'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED',
									eventTime: { seconds: 1700000000 },
									taskId: 100,
									workflowExecutionStartedEventAttributes:
										{
											workflowType: {
												name: 'MyWorkflow',
											},
										},
								},
								{
									eventId: 2,
									eventType:
										'EVENT_TYPE_WORKFLOW_TASK_SCHEDULED',
									eventTime: { seconds: 1700000001 },
									taskId: 101,
								},
							],
						},
					}),
				),
			},
		});

		const result = await getWorkflowExecutionHistoryReverse(client, {
			namespace: 'default',
			workflowId: 'wf-1',
			runId: 'run-1',
			pageSize: 50,
		});

		expect(result.events).toHaveLength(2);
		expect(result.events[0]!.eventId).toBe(1);
		expect(result.events[0]!.eventType).toBe(
			'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED',
		);
		expect(result.events[0]!.eventTime).toBeTypeOf('string');
		expect(result.events[0]!.taskId).toBe(100);
		expect(result.events[0]!.attributes).toBeTruthy();
		expect(result.events[1]!.eventId).toBe(2);
	});

	test('handles empty history', async () => {
		const client = createMockClient();
		const result = await getWorkflowExecutionHistoryReverse(client, {
			namespace: 'default',
			workflowId: 'wf-1',
			runId: 'run-1',
		});

		expect(result.events).toEqual([]);
		expect(result.nextPageToken).toBeNull();
	});

	test('encodes nextPageToken as base64', async () => {
		const client = createMockClient({
			workflowService: {
				getWorkflowExecutionHistory: mock(() =>
					Promise.resolve({
						history: { events: [] },
						nextPageToken: new Uint8Array([1, 2, 3, 4]),
					}),
				),
			},
		});

		const result = await getWorkflowExecutionHistoryReverse(client, {
			namespace: 'default',
			workflowId: 'wf-1',
			runId: 'run-1',
		});

		expect(result.nextPageToken).toBeTypeOf('string');
		expect(result.nextPageToken!.length).toBeGreaterThan(0);
	});
});

// --- listScheduleMatchingTimes ---

describe('listScheduleMatchingTimes', () => {
	test('calls workflowService.listScheduleMatchingTimes', async () => {
		const client = createMockClient();
		await listScheduleMatchingTimes(client, {
			namespace: 'default',
			scheduleId: 'sched-1',
			startTime: '2026-01-01T00:00:00Z',
			endTime: '2026-01-02T00:00:00Z',
		});

		expect(
			client.workflowService.listScheduleMatchingTimes,
		).toHaveBeenCalledWith({
			namespace: 'default',
			scheduleId: 'sched-1',
			startTime: {
				seconds: Math.floor(
					new Date('2026-01-01T00:00:00Z').getTime() / 1000,
				),
			},
			endTime: {
				seconds: Math.floor(
					new Date('2026-01-02T00:00:00Z').getTime() / 1000,
				),
			},
		});
	});

	test('maps start times from proto timestamps', async () => {
		const client = createMockClient({
			workflowService: {
				listScheduleMatchingTimes: mock(() =>
					Promise.resolve({
						startTime: [
							{ seconds: 1700000000 },
							{ seconds: 1700003600 },
						],
					}),
				),
			},
		});

		const result = await listScheduleMatchingTimes(client, {
			namespace: 'default',
			scheduleId: 'sched-1',
			startTime: '2026-01-01T00:00:00Z',
			endTime: '2026-01-02T00:00:00Z',
		});

		expect(result.startTimes).toHaveLength(2);
		expect(result.startTimes[0]).toBeTypeOf('string');
		expect(result.startTimes[1]).toBeTypeOf('string');
	});

	test('handles empty matching times', async () => {
		const client = createMockClient();
		const result = await listScheduleMatchingTimes(client, {
			namespace: 'default',
			scheduleId: 'sched-1',
			startTime: '2026-01-01T00:00:00Z',
			endTime: '2026-01-02T00:00:00Z',
		});

		expect(result.startTimes).toEqual([]);
	});
});

// --- listWorkerDeployments ---

describe('listWorkerDeployments', () => {
	test('calls workflowService.listWorkerDeployments', async () => {
		const client = createMockClient();
		await listWorkerDeployments(client, { namespace: 'default' });

		expect(
			client.workflowService.listWorkerDeployments,
		).toHaveBeenCalledWith({
			namespace: 'default',
			pageSize: 100,
		});
	});

	test('maps deployment summaries', async () => {
		const client = createMockClient({
			workflowService: {
				listWorkerDeployments: mock(() =>
					Promise.resolve({
						workerDeployments: [
							{
								name: 'deploy-1',
								createTime: { seconds: 1700000000 },
							},
							{
								name: 'deploy-2',
							},
						],
					}),
				),
			},
		});

		const result = await listWorkerDeployments(client, {
			namespace: 'default',
		});

		expect(result.deployments).toHaveLength(2);
		expect(result.deployments[0]!.name).toBe('deploy-1');
		expect(result.deployments[0]!.createTime).toBeTypeOf('string');
		expect(result.deployments[1]!.name).toBe('deploy-2');
		expect(result.deployments[1]!.createTime).toBeNull();
	});

	test('handles empty deployment list', async () => {
		const client = createMockClient();
		const result = await listWorkerDeployments(client, {
			namespace: 'default',
		});

		expect(result.deployments).toEqual([]);
		expect(result.nextPageToken).toBeNull();
	});
});

// --- describeWorkerDeployment ---

describe('describeWorkerDeployment', () => {
	test('calls workflowService.describeWorkerDeployment', async () => {
		const client = createMockClient();
		await describeWorkerDeployment(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
		});

		expect(
			client.workflowService.describeWorkerDeployment,
		).toHaveBeenCalledWith({
			namespace: 'default',
			deploymentName: 'deploy-1',
		});
	});

	test('maps deployment description with versions', async () => {
		const client = createMockClient({
			workflowService: {
				describeWorkerDeployment: mock(() =>
					Promise.resolve({
						workerDeploymentInfo: {
							name: 'deploy-1',
							createTime: { seconds: 1700000000 },
							currentVersion: {
								buildId: 'v2',
								createTime: { seconds: 1700000100 },
								currentSinceTime: {
									seconds: 1700000200,
								},
								rampingVersionPercentage: 0,
							},
							rampingVersion: {
								buildId: 'v3',
								createTime: { seconds: 1700000300 },
								currentSinceTime: null,
								rampingVersionPercentage: 25,
							},
						},
					}),
				),
			},
		});

		const result = await describeWorkerDeployment(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
		});

		expect(result.name).toBe('deploy-1');
		expect(result.createTime).toBeTypeOf('string');
		expect(result.currentVersion).not.toBeNull();
		expect(result.currentVersion!.buildId).toBe('v2');
		expect(result.rampingVersion).not.toBeNull();
		expect(result.rampingVersion!.buildId).toBe('v3');
		expect(result.rampingVersion!.rampingVersionPercentage).toBe(25);
	});

	test('handles empty deployment description', async () => {
		const client = createMockClient();
		const result = await describeWorkerDeployment(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
		});

		expect(result.name).toBe('deploy-1');
		expect(result.createTime).toBeNull();
		expect(result.currentVersion).toBeNull();
		expect(result.rampingVersion).toBeNull();
	});
});

// --- describeWorkerDeploymentVersion ---

describe('describeWorkerDeploymentVersion', () => {
	test('calls workflowService.describeWorkerDeploymentVersion', async () => {
		const client = createMockClient();
		await describeWorkerDeploymentVersion(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
			buildId: 'v2',
		});

		expect(
			client.workflowService.describeWorkerDeploymentVersion,
		).toHaveBeenCalledWith({
			namespace: 'default',
			version: 'deploy-1.v2',
		});
	});

	test('maps version description with task queues', async () => {
		const client = createMockClient({
			workflowService: {
				describeWorkerDeploymentVersion: mock(() =>
					Promise.resolve({
						workerDeploymentVersionInfo: {
							deploymentName: 'deploy-1',
							buildId: 'v2',
							createTime: { seconds: 1700000000 },
							currentSinceTime: {
								seconds: 1700000100,
							},
							rampingVersionPercentage: 0,
							taskQueues: [
								{
									name: 'queue-1',
									taskQueueType:
										'TASK_QUEUE_TYPE_WORKFLOW',
								},
								{
									name: 'queue-2',
									taskQueueType:
										'TASK_QUEUE_TYPE_ACTIVITY',
								},
							],
							drainageState: 'DRAINAGE_STATE_DRAINED',
						},
					}),
				),
			},
		});

		const result = await describeWorkerDeploymentVersion(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
			buildId: 'v2',
		});

		expect(result.deploymentName).toBe('deploy-1');
		expect(result.buildId).toBe('v2');
		expect(result.createTime).toBeTypeOf('string');
		expect(result.taskQueues).toHaveLength(2);
		expect(result.taskQueues[0]!.name).toBe('queue-1');
		expect(result.taskQueues[1]!.taskQueueType).toBe(
			'TASK_QUEUE_TYPE_ACTIVITY',
		);
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
		expect(result.createTime).toBeNull();
		expect(result.taskQueues).toEqual([]);
		expect(result.drainageState).toBe(
			'DRAINAGE_STATE_UNSPECIFIED',
		);
	});
});

// --- getDeploymentReachability ---

describe('getDeploymentReachability', () => {
	test('calls workflowService.getDeploymentReachability', async () => {
		const client = createMockClient();
		await getDeploymentReachability(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
		});

		expect(
			client.workflowService.getDeploymentReachability,
		).toHaveBeenCalledWith({
			namespace: 'default',
			deploymentName: 'deploy-1',
		});
	});

	test('maps reachability entries', async () => {
		const client = createMockClient({
			workflowService: {
				getDeploymentReachability: mock(() =>
					Promise.resolve({
						entries: [
							{
								buildId: 'v2',
								taskQueueReachability: [
									{
										taskQueue: 'queue-1',
										reachability: [
											'REACHABILITY_REACHABLE',
										],
									},
								],
							},
						],
					}),
				),
			},
		});

		const result = await getDeploymentReachability(client, {
			namespace: 'default',
			deploymentName: 'deploy-1',
		});

		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]!.buildId).toBe('v2');
		expect(
			result.entries[0]!.taskQueueReachability,
		).toHaveLength(1);
		expect(
			result.entries[0]!.taskQueueReachability[0]!.taskQueue,
		).toBe('queue-1');
		expect(
			result.entries[0]!.taskQueueReachability[0]!.reachability,
		).toEqual(['REACHABILITY_REACHABLE']);
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
