import type { Client } from '@temporalio/client';
import { describeTaskQueue as grpcDescribeTaskQueue } from '../../grpc.ts';
import type { TaskQueueDescription } from '../../grpc.ts';

export interface TaskQueueDescribeInput {
	namespace: string;
	taskQueue: string;
	taskQueueType?: number;
}

export async function describeTaskQueueTool(
	client: Client,
	input: TaskQueueDescribeInput,
): Promise<TaskQueueDescription> {
	return grpcDescribeTaskQueue(client, input);
}
