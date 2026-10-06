export {
	TemporalConnectionManager,
	createCodecDataConverter,
} from './connection.ts';
export type { CodecSecurityConfig } from './connection.ts';

export { RemotePayloadCodec } from './payload-codec.ts';
export type { RemotePayloadCodecOptions } from './payload-codec.ts';

export { PayloadDecoder } from './payload-decoder.ts';
export type { DecodedPayload } from './payload-decoder.ts';

export {
	DEFAULT_CODEC_TIMEOUT_MS,
	codecEndpointBlockedReason,
	isPrivateAddress,
	postToCodecEndpoint,
} from './codec-endpoint.ts';

export {
	decodeHistoryPayloads,
	getClientPayloadCodecs,
} from './history-payloads.ts';
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
