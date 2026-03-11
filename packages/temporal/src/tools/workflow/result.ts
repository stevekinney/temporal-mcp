import type { Client } from '@temporalio/client';

export interface WorkflowResultInput {
	workflowId: string;
	runId?: string;
}

export async function getWorkflowResult(client: Client, input: WorkflowResultInput): Promise<unknown> {
	const handle = client.workflow.getHandle(input.workflowId, input.runId);
	return await handle.result();
}
