import type { Client } from '@temporalio/client';

function toNumberOrNull(value: unknown): number | null {
	return value === null || value === undefined ? null : Number(value);
}

// --- Task Queue ---

export interface TaskQueuePoller {
	lastAccessTime: string | null;
	identity: string;
	ratePerSecond: number;
	workerVersionCapabilities: unknown;
}

export interface TaskQueueStatus {
	backlogCountHint: number;
	readLevel: number;
	ackLevel: number;
	taskIdBlock: number;
}

export interface TaskQueueDescription {
	taskQueue: string;
	pollers: TaskQueuePoller[];
	taskQueueStatus: TaskQueueStatus | null;
}

export async function describeTaskQueue(
	client: Client,
	params: { namespace: string; taskQueue: string; taskQueueType?: number },
): Promise<TaskQueueDescription> {
	const response = await (client.workflowService as any).describeTaskQueue({
		namespace: params.namespace,
		taskQueue: { name: params.taskQueue },
		taskQueueType: params.taskQueueType ?? 1, // TASK_QUEUE_TYPE_WORKFLOW
		includeTaskQueueStatus: true,
	});

	return {
		taskQueue: params.taskQueue,
		pollers: (response.pollers ?? []).map((poller: any) => ({
			lastAccessTime: poller.lastAccessTime?.seconds
				? new Date(
						Number(poller.lastAccessTime.seconds) * 1000,
					).toISOString()
				: null,
			identity: poller.identity ?? '',
			ratePerSecond: poller.ratePerSecond ?? 0,
			workerVersionCapabilities:
				poller.workerVersionCapabilities ?? null,
		})),
		taskQueueStatus: response.taskQueueStatus
			? {
					backlogCountHint: Number(
						response.taskQueueStatus.backlogCountHint ?? 0,
					),
					readLevel: Number(
						response.taskQueueStatus.readLevel ?? 0,
					),
					ackLevel: Number(response.taskQueueStatus.ackLevel ?? 0),
					taskIdBlock: Number(
						response.taskQueueStatus.taskIdBlock ?? 0,
					),
				}
			: null,
	};
}

// --- Task Queue Configuration ---

export interface TaskQueueConfiguration {
	taskQueue: string;
	maxTasksPerSecond: number | null;
	pollerConfiguration: {
		maximumPollersCount: number | null;
	} | null;
}

export async function getTaskQueueConfiguration(
	client: Client,
	params: { namespace: string; taskQueue: string },
): Promise<TaskQueueConfiguration> {
	const response = await (client.workflowService as any).describeTaskQueue({
		namespace: params.namespace,
		taskQueue: { name: params.taskQueue },
		taskQueueType: 1,
		includeTaskQueueStatus: false,
	});

	return {
		taskQueue: params.taskQueue,
		maxTasksPerSecond: toNumberOrNull(response.maxTasksPerSecond),
		pollerConfiguration: response.pollerConfiguration
			? {
					maximumPollersCount: toNumberOrNull(
						response.pollerConfiguration.maximumPollersCount,
					),
				}
			: null,
	};
}

// --- Namespaces ---

export interface NamespaceInfo {
	name: string;
	state: string;
	description: string;
	ownerEmail: string;
	retentionDays: number;
}

export interface NamespaceListResult {
	namespaces: NamespaceInfo[];
}

function mapNamespaceInfo(namespace: any): NamespaceInfo {
	return {
		name: namespace.namespaceInfo?.name ?? '',
		state: namespace.namespaceInfo?.state ?? 'NAMESPACE_STATE_UNSPECIFIED',
		description: namespace.namespaceInfo?.description ?? '',
		ownerEmail: namespace.namespaceInfo?.ownerEmail ?? '',
		retentionDays: namespace.config?.workflowExecutionRetentionTtl?.seconds
			? Number(namespace.config.workflowExecutionRetentionTtl.seconds) /
				86400
			: 0,
	};
}

export async function listNamespaces(
	client: Client,
	params: { pageSize?: number } = {},
): Promise<NamespaceListResult> {
	const response = await (client.workflowService as any).listNamespaces({
		pageSize: params.pageSize ?? 100,
	});

	return {
		namespaces: (response.namespaces ?? []).map(mapNamespaceInfo),
	};
}

// --- Describe Namespace ---

export interface NamespaceDescription {
	name: string;
	state: string;
	description: string;
	ownerEmail: string;
	retentionDays: number;
	activeClusterName: string;
	clusters: string[];
	historyArchivalState: string;
	visibilityArchivalState: string;
}

export async function describeNamespace(
	client: Client,
	params: { namespace: string },
): Promise<NamespaceDescription> {
	const response = await (client.workflowService as any).describeNamespace({
		namespace: params.namespace,
	});

	return {
		name: response.namespaceInfo?.name ?? '',
		state:
			response.namespaceInfo?.state ?? 'NAMESPACE_STATE_UNSPECIFIED',
		description: response.namespaceInfo?.description ?? '',
		ownerEmail: response.namespaceInfo?.ownerEmail ?? '',
		retentionDays: response.config?.workflowExecutionRetentionTtl?.seconds
			? Number(response.config.workflowExecutionRetentionTtl.seconds) /
				86400
			: 0,
		activeClusterName:
			response.replicationConfig?.activeClusterName ?? '',
		clusters: (response.replicationConfig?.clusters ?? []).map(
			(cluster: any) => cluster.clusterName ?? '',
		),
		historyArchivalState:
			response.config?.historyArchivalState ??
			'ARCHIVAL_STATE_UNSPECIFIED',
		visibilityArchivalState:
			response.config?.visibilityArchivalState ??
			'ARCHIVAL_STATE_UNSPECIFIED',
	};
}

// --- Search Attributes ---

export interface SearchAttributeList {
	customAttributes: Record<string, string>;
	systemAttributes: Record<string, string>;
}

export async function listSearchAttributes(
	client: Client,
	params: { namespace: string },
): Promise<SearchAttributeList> {
	const response = await (client as any).operatorService.listSearchAttributes(
		{
			namespace: params.namespace,
		},
	);

	const mapAttributes = (attributes: any): Record<string, string> => {
		if (!attributes || typeof attributes !== 'object') return {};
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(attributes)) {
			result[key] = String(value ?? 'INDEXED_VALUE_TYPE_UNSPECIFIED');
		}
		return result;
	};

	return {
		customAttributes: mapAttributes(response.customAttributes),
		systemAttributes: mapAttributes(response.systemAttributes),
	};
}

// --- System Info ---

export interface SystemInfoCapabilities {
	signalAndQueryHeader: boolean;
	internalErrorDifferentiation: boolean;
	activityFailureIncludeHeartbeat: boolean;
	supportsSchedules: boolean;
	encodedFailureAttributes: boolean;
	buildIdBasedVersioning: boolean;
	upsertMemo: boolean;
	eagerWorkflowStart: boolean;
	sdkMetadata: boolean;
	countGroupByExecutionStatus: boolean;
}

export interface SystemInfo {
	serverVersion: string;
	capabilities: SystemInfoCapabilities;
}

export async function getSystemInfo(client: Client): Promise<SystemInfo> {
	const response = await (
		client.workflowService as any
	).getSystemInfo({});

	const capabilities = response.capabilities ?? {};

	return {
		serverVersion: response.serverVersion ?? '',
		capabilities: {
			signalAndQueryHeader:
				capabilities.signalAndQueryHeader ?? false,
			internalErrorDifferentiation:
				capabilities.internalErrorDifferentiation ?? false,
			activityFailureIncludeHeartbeat:
				capabilities.activityFailureIncludeHeartbeat ?? false,
			supportsSchedules: capabilities.supportsSchedules ?? false,
			encodedFailureAttributes:
				capabilities.encodedFailureAttributes ?? false,
			buildIdBasedVersioning:
				capabilities.buildIdBasedVersioning ?? false,
			upsertMemo: capabilities.upsertMemo ?? false,
			eagerWorkflowStart: capabilities.eagerWorkflowStart ?? false,
			sdkMetadata: capabilities.sdkMetadata ?? false,
			countGroupByExecutionStatus:
				capabilities.countGroupByExecutionStatus ?? false,
		},
	};
}

// --- Worker Versioning Rules ---

export interface VersioningAssignmentRule {
	targetBuildId: string;
	percentageRamp: number | null;
	createTime: string | null;
}

export interface VersioningRedirectRule {
	sourceBuildId: string;
	targetBuildId: string;
	createTime: string | null;
}

export interface WorkerVersioningRules {
	assignmentRules: VersioningAssignmentRule[];
	redirectRules: VersioningRedirectRule[];
	conflictToken: string | null;
}

export async function getWorkerVersioningRules(
	client: Client,
	params: { namespace: string; taskQueue: string },
): Promise<WorkerVersioningRules> {
	const response = await (
		client.workflowService as any
	).getWorkerVersioningRules({
		namespace: params.namespace,
		taskQueue: params.taskQueue,
	});

	return {
		assignmentRules: (response.assignmentRules ?? []).map((rule: any) => ({
			targetBuildId: rule.rule?.targetBuildId ?? '',
			percentageRamp: toNumberOrNull(
				rule.rule?.percentageRamp?.rampPercentage,
			),
			createTime: rule.createTime?.seconds
				? new Date(
						Number(rule.createTime.seconds) * 1000,
					).toISOString()
				: null,
		})),
		redirectRules: (response.redirectRules ?? []).map((rule: any) => ({
			sourceBuildId: rule.rule?.sourceBuildId ?? '',
			targetBuildId: rule.rule?.targetBuildId ?? '',
			createTime: rule.createTime?.seconds
				? new Date(
						Number(rule.createTime.seconds) * 1000,
					).toISOString()
				: null,
		})),
		conflictToken: response.conflictToken
			? String(response.conflictToken)
			: null,
	};
}

// --- Workflow Execution History (Reverse) ---

export interface HistoryEvent {
	eventId: number;
	eventType: string;
	eventTime: string | null;
	taskId: number;
	attributes: unknown;
}

export interface WorkflowHistoryResult {
	events: HistoryEvent[];
	nextPageToken: string | null;
}

export async function getWorkflowExecutionHistoryReverse(
	client: Client,
	params: {
		namespace: string;
		workflowId: string;
		runId: string;
		pageSize?: number;
	},
): Promise<WorkflowHistoryResult> {
	const response = await (
		client.workflowService as any
	).getWorkflowExecutionHistory({
		namespace: params.namespace,
		execution: {
			workflowId: params.workflowId,
			runId: params.runId,
		},
		maximumPageSize: params.pageSize ?? 100,
		reverseOrder: true,
	});

	const events: HistoryEvent[] = (
		response.history?.events ?? []
	).map((event: any) => ({
		eventId: Number(event.eventId ?? 0),
		eventType: event.eventType ?? 'EVENT_TYPE_UNSPECIFIED',
		eventTime: event.eventTime?.seconds
			? new Date(Number(event.eventTime.seconds) * 1000).toISOString()
			: null,
		taskId: Number(event.taskId ?? 0),
		attributes: extractEventAttributes(event),
	}));

	return {
		events,
		nextPageToken: response.nextPageToken?.length
			? Buffer.from(response.nextPageToken).toString('base64')
			: null,
	};
}

function extractEventAttributes(event: any): unknown {
	// Proto events have one "xxxAttributes" field set. Extract whichever one exists.
	const attributeKeys = Object.keys(event).filter((key) =>
		key.endsWith('Attributes'),
	);
	if (attributeKeys.length === 0) return null;
	const key = attributeKeys[0]!;
	return event[key] ?? null;
}

// --- Schedule Matching Times ---

export interface ScheduleMatchingTimes {
	startTimes: string[];
}

export async function listScheduleMatchingTimes(
	client: Client,
	params: {
		namespace: string;
		scheduleId: string;
		startTime: string;
		endTime: string;
	},
): Promise<ScheduleMatchingTimes> {
	const response = await (
		client.workflowService as any
	).listScheduleMatchingTimes({
		namespace: params.namespace,
		scheduleId: params.scheduleId,
		startTime: { seconds: Math.floor(new Date(params.startTime).getTime() / 1000) },
		endTime: { seconds: Math.floor(new Date(params.endTime).getTime() / 1000) },
	});

	return {
		startTimes: (response.startTime ?? []).map((timestamp: any) =>
			timestamp?.seconds
				? new Date(Number(timestamp.seconds) * 1000).toISOString()
				: '',
		),
	};
}

// --- Worker Deployments ---

export interface WorkerDeploymentSummary {
	name: string;
	createTime: string | null;
}

export interface WorkerDeploymentList {
	deployments: WorkerDeploymentSummary[];
	nextPageToken: string | null;
}

export async function listWorkerDeployments(
	client: Client,
	params: { namespace: string; pageSize?: number },
): Promise<WorkerDeploymentList> {
	const response = await (
		client.workflowService as any
	).listWorkerDeployments({
		namespace: params.namespace,
		pageSize: params.pageSize ?? 100,
	});

	return {
		deployments: (response.workerDeployments ?? []).map(
			(deployment: any) => ({
				name: deployment.name ?? '',
				createTime: deployment.createTime?.seconds
					? new Date(
							Number(deployment.createTime.seconds) * 1000,
						).toISOString()
					: null,
			}),
		),
		nextPageToken: response.nextPageToken?.length
			? Buffer.from(response.nextPageToken).toString('base64')
			: null,
	};
}

// --- Describe Worker Deployment ---

export interface WorkerDeploymentVersionSummary {
	buildId: string;
	createTime: string | null;
	currentSinceTime: string | null;
	rampingVersionPercentage: number;
}

export interface WorkerDeploymentDescription {
	name: string;
	createTime: string | null;
	currentVersion: WorkerDeploymentVersionSummary | null;
	rampingVersion: WorkerDeploymentVersionSummary | null;
}

function mapDeploymentVersionSummary(
	version: any,
): WorkerDeploymentVersionSummary | null {
	if (!version) return null;
	return {
		buildId: version.buildId ?? '',
		createTime: version.createTime?.seconds
			? new Date(Number(version.createTime.seconds) * 1000).toISOString()
			: null,
		currentSinceTime: version.currentSinceTime?.seconds
			? new Date(
					Number(version.currentSinceTime.seconds) * 1000,
				).toISOString()
			: null,
		rampingVersionPercentage: Number(
			version.rampingVersionPercentage ?? 0,
		),
	};
}

export async function describeWorkerDeployment(
	client: Client,
	params: { namespace: string; deploymentName: string },
): Promise<WorkerDeploymentDescription> {
	const response = await (
		client.workflowService as any
	).describeWorkerDeployment({
		namespace: params.namespace,
		deploymentName: params.deploymentName,
	});

	return {
		name: response.workerDeploymentInfo?.name ?? params.deploymentName,
		createTime: response.workerDeploymentInfo?.createTime?.seconds
			? new Date(
					Number(
						response.workerDeploymentInfo.createTime.seconds,
					) * 1000,
				).toISOString()
			: null,
		currentVersion: mapDeploymentVersionSummary(
			response.workerDeploymentInfo?.currentVersion,
		),
		rampingVersion: mapDeploymentVersionSummary(
			response.workerDeploymentInfo?.rampingVersion,
		),
	};
}

// --- Describe Worker Deployment Version ---

export interface TaskQueueInfo {
	name: string;
	taskQueueType: string;
}

export interface WorkerDeploymentVersionDescription {
	deploymentName: string;
	buildId: string;
	createTime: string | null;
	currentSinceTime: string | null;
	rampingVersionPercentage: number;
	taskQueues: TaskQueueInfo[];
	drainageState: string;
}

export async function describeWorkerDeploymentVersion(
	client: Client,
	params: { namespace: string; deploymentName: string; buildId: string },
): Promise<WorkerDeploymentVersionDescription> {
	const response = await (
		client.workflowService as any
	).describeWorkerDeploymentVersion({
		namespace: params.namespace,
		version: `${params.deploymentName}.${params.buildId}`,
	});

	const info = response.workerDeploymentVersionInfo ?? {};

	return {
		deploymentName: info.deploymentName ?? params.deploymentName,
		buildId: info.buildId ?? params.buildId,
		createTime: info.createTime?.seconds
			? new Date(Number(info.createTime.seconds) * 1000).toISOString()
			: null,
		currentSinceTime: info.currentSinceTime?.seconds
			? new Date(
					Number(info.currentSinceTime.seconds) * 1000,
				).toISOString()
			: null,
		rampingVersionPercentage: Number(
			info.rampingVersionPercentage ?? 0,
		),
		taskQueues: (info.taskQueues ?? []).map((queue: any) => ({
			name: queue.name ?? '',
			taskQueueType:
				queue.taskQueueType ?? 'TASK_QUEUE_TYPE_UNSPECIFIED',
		})),
		drainageState:
			info.drainageState ?? 'DRAINAGE_STATE_UNSPECIFIED',
	};
}

// --- Deployment Reachability ---

export interface DeploymentReachabilityEntry {
	buildId: string;
	taskQueueReachability: Array<{
		taskQueue: string;
		reachability: string[];
	}>;
}

export interface DeploymentReachabilityInfo {
	entries: DeploymentReachabilityEntry[];
}

export async function getDeploymentReachability(
	client: Client,
	params: { namespace: string; deploymentName: string },
): Promise<DeploymentReachabilityInfo> {
	const response = await (
		client.workflowService as any
	).getDeploymentReachability({
		namespace: params.namespace,
		deploymentName: params.deploymentName,
	});

	return {
		entries: (response.entries ?? []).map((entry: any) => ({
			buildId: entry.buildId ?? '',
			taskQueueReachability: (
				entry.taskQueueReachability ?? []
			).map((reachability: any) => ({
				taskQueue: reachability.taskQueue ?? '',
				reachability: (reachability.reachability ?? []).map(String),
			})),
		})),
	};
}
