export interface GuidanceAnnotation {
	condition: (data: unknown) => boolean;
	guidance: string;
}

function hasWorkflowStatus(data: unknown, status: string): boolean {
	return (
		typeof data === 'object' &&
		data !== null &&
		'status' in data &&
		(data as Record<string, unknown>).status === status
	);
}

function hasWorkflowTaskFailures(data: unknown): boolean {
	if (typeof data !== 'object' || data === null) return false;
	const d = data as Record<string, unknown>;
	const counts = d.eventTypeCounts;
	if (typeof counts !== 'object' || counts === null) return false;
	const failedCount = (counts as Record<string, unknown>)['EVENT_TYPE_WORKFLOW_TASK_FAILED'];
	return typeof failedCount === 'number' && failedCount > 0;
}

export const TOOL_GUIDANCE: Record<string, GuidanceAnnotation[]> = {
	'temporal.workflow.describe': [
		{
			condition: (data) =>
				hasWorkflowStatus(data, 'WORKFLOW_EXECUTION_STATUS_TIMED_OUT'),
			guidance:
				'Workflow timed out. See skill/references/core/gotchas.md for common timeout causes and skill/references/core/troubleshooting.md for the timeout recovery decision tree.',
		},
		{
			condition: (data) =>
				hasWorkflowStatus(data, 'WORKFLOW_EXECUTION_STATUS_FAILED'),
			guidance:
				'Workflow failed. See skill/references/core/error-reference.md for error classification and skill/references/core/troubleshooting.md for recovery patterns.',
		},
		{
			condition: (data) =>
				hasWorkflowStatus(data, 'WORKFLOW_EXECUTION_STATUS_CANCELED'),
			guidance:
				'Workflow was cancelled. See skill/references/core/patterns.md for cancellation handling patterns and how to implement cleanup.',
		},
		{
			condition: (data) =>
				hasWorkflowStatus(data, 'WORKFLOW_EXECUTION_STATUS_TERMINATED'),
			guidance:
				'Workflow was terminated. See skill/references/core/troubleshooting.md for termination causes. Terminated workflows cannot be recovered — start a new execution.',
		},
	],
	'temporal.workflow.history.summarize': [
		{
			condition: hasWorkflowTaskFailures,
			guidance:
				'Workflow task failures detected. These are often caused by non-determinism errors. See skill/references/core/determinism.md for replay mechanics and skill/references/core/versioning.md for safe migration patterns. Use temporal.workflow.history to retrieve the full event sequence and identify where replay diverged.',
		},
	],
};
