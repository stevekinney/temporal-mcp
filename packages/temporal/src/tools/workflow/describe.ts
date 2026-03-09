import type { Client } from '@temporalio/client';

interface WorkflowDescribeInput {
	workflowId: string;
	runId?: string;
}

interface WorkflowDescription {
	workflowId: string;
	runId: string;
	type: string;
	status: string;
	taskQueue: string;
	startTime: string;
	closeTime: string | null;
	executionTime: string | null;
	historyLength: number;
	memo: Record<string, unknown>;
	searchAttributes: Record<string, unknown>;
	parentWorkflowId: string | null;
}

export async function describeWorkflow(
	client: Client,
	input: WorkflowDescribeInput,
): Promise<WorkflowDescription> {
	const handle = client.workflow.getHandle(input.workflowId, input.runId);
	const description = await handle.describe();

	return {
		workflowId: description.workflowId,
		runId: description.runId,
		type: description.type,
		status: String(description.status.name),
		taskQueue: description.taskQueue,
		startTime: description.startTime.toISOString(),
		closeTime: description.closeTime?.toISOString() ?? null,
		executionTime: description.executionTime?.toISOString() ?? null,
		historyLength: Number(description.historyLength),
		memo: description.memo ?? {},
		searchAttributes: description.searchAttributes ?? {},
		parentWorkflowId: description.parentExecution?.workflowId ?? null,
	};
}
