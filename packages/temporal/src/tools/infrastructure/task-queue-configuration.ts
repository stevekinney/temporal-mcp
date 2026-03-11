import type { Client } from '@temporalio/client';
import { getTaskQueueConfiguration as grpcGetConfiguration } from '../../grpc.ts';
import type { TaskQueueConfiguration } from '../../grpc.ts';

export interface TaskQueueConfigurationInput {
	namespace: string;
	taskQueue: string;
}

export async function getTaskQueueConfigurationTool(
	client: Client,
	input: TaskQueueConfigurationInput,
): Promise<TaskQueueConfiguration> {
	return grpcGetConfiguration(client, input);
}
