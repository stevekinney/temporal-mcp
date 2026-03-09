import type { Client } from '@temporalio/client';

export interface WorkflowQueryInput {
	workflowId: string;
	runId?: string;
	queryName: string;
	args?: unknown[];
}

export async function queryWorkflow(client: Client, input: WorkflowQueryInput): Promise<unknown> {
	const handle = client.workflow.getHandle(input.workflowId, input.runId);
	return await handle.query<unknown, unknown[]>(input.queryName, ...(input.args ?? []));
}
