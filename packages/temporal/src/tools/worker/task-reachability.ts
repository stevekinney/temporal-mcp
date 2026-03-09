import type { Client } from '@temporalio/client';

export interface TaskReachabilityInput {
	taskQueue: string;
	buildIds?: string[];
}

export async function getTaskReachability(client: Client, input: TaskReachabilityInput): Promise<unknown> {
	const grpcResponse = await (client.workflowService as any).getWorkerTaskReachability({
		buildIds: input.buildIds ?? [],
		taskQueues: [input.taskQueue],
	});

	return {
		buildIdReachability: (grpcResponse.buildIdReachability ?? []).map((entry: any) => ({
			buildId: entry.buildId ?? '',
			taskQueueReachability: (entry.taskQueueReachability ?? []).map((taskQueue: any) => ({
				taskQueue: taskQueue.taskQueue ?? '',
				reachability: (taskQueue.reachability ?? []).map(String),
			})),
		})),
	};
}
