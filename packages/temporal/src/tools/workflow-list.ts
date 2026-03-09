import type { Client } from '@temporalio/client';

interface WorkflowListInput {
	query?: string;
	pageSize: number;
}

interface WorkflowSummary {
	workflowId: string;
	runId: string;
	type: string;
	status: string;
	startTime: string;
	closeTime: string | null;
}

export async function listWorkflows(
	client: Client,
	input: WorkflowListInput,
): Promise<WorkflowSummary[]> {
	const results: WorkflowSummary[] = [];

	const workflows = client.workflow.list({ query: input.query });

	for await (const workflow of workflows) {
		results.push({
			workflowId: workflow.workflowId,
			runId: workflow.runId,
			type: workflow.type,
			status: String(workflow.status.name),
			startTime: workflow.startTime.toISOString(),
			closeTime: workflow.closeTime?.toISOString() ?? null,
		});

		if (results.length >= input.pageSize) break;
	}

	return results;
}
