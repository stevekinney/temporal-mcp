import type { Client } from '@temporalio/client';

export interface WorkflowCountInput {
	query?: string;
}

export interface WorkflowCountResult {
	count: number;
	groups: Array<{ groupValues: unknown[]; count: number }>;
}

export async function countWorkflows(client: Client, input: WorkflowCountInput): Promise<WorkflowCountResult> {
	const result = await client.workflow.count(input.query);
	return {
		count: result.count,
		groups: result.groups.map((group) => ({
			groupValues: group.groupValues,
			count: group.count,
		})),
	};
}
