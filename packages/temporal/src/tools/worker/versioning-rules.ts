import type { Client } from '@temporalio/client';
import { getWorkerVersioningRules as grpcGetRules } from '../../grpc.ts';
import type { WorkerVersioningRules } from '../../grpc.ts';

export interface VersioningRulesInput {
	namespace: string;
	taskQueue: string;
}

export async function getVersioningRules(
	client: Client,
	input: VersioningRulesInput,
): Promise<WorkerVersioningRules> {
	return grpcGetRules(client, input);
}
