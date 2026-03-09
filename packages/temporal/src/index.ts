export { TemporalConnectionManager } from './connection.ts';
export {
	getToolContract,
	getAllToolContracts,
	assertToolAvailable,
	TOOL_CONTRACTS,
} from './capability-matrix.ts';

export {
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
} from './grpc.ts';

export type {
	TaskQueueDescription,
	TaskQueuePoller,
	TaskQueueStatus,
	TaskQueueConfiguration,
	NamespaceInfo,
	NamespaceListResult,
	NamespaceDescription,
	SearchAttributeList,
	SystemInfo,
	SystemInfoCapabilities,
	WorkerVersioningRules,
	VersioningAssignmentRule,
	VersioningRedirectRule,
	HistoryEvent,
	WorkflowHistoryResult,
	ScheduleMatchingTimes,
	WorkerDeploymentList,
	WorkerDeploymentSummary,
	WorkerDeploymentDescription,
	WorkerDeploymentVersionSummary,
	WorkerDeploymentVersionDescription,
	TaskQueueInfo,
	DeploymentReachabilityInfo,
	DeploymentReachabilityEntry,
} from './grpc.ts';

export {
	listCloudNamespaces,
	describeCloudNamespace,
	getCloudAccountInfo,
} from './cloud.ts';
