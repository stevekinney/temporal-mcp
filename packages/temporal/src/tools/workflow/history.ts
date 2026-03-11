import type { Client } from '@temporalio/client';
import { getWorkflowExecutionHistoryReverse } from '../../grpc.ts';
import type { WorkflowHistoryResult } from '../../grpc.ts';

export interface WorkflowHistoryInput {
	workflowId: string;
	runId?: string;
}

export async function getWorkflowHistory(client: Client, input: WorkflowHistoryInput): Promise<unknown> {
	const handle = client.workflow.getHandle(input.workflowId, input.runId);
	const history = await handle.fetchHistory();
	return {
		events:
			history.events?.map((event: any) => ({
				eventId: String(event.eventId),
				eventType: event.eventType,
				eventTime: event.eventTime?.toISOString?.() ?? null,
				taskId: String(event.taskId ?? ''),
				attributes: extractAttributes(event),
			})) ?? [],
	};
}

export async function getWorkflowHistoryReverse(
	client: Client,
	input: WorkflowHistoryInput & { namespace: string; pageSize?: number },
): Promise<WorkflowHistoryResult> {
	return getWorkflowExecutionHistoryReverse(client, {
		namespace: input.namespace,
		workflowId: input.workflowId,
		runId: input.runId ?? '',
		pageSize: input.pageSize,
	});
}

export interface HistorySummary {
	totalEvents: number;
	eventTypeCounts: Record<string, number>;
	milestones: Array<{ eventId: string; eventType: string; eventTime: string | null }>;
}

export function summarizeWorkflowHistory(
	events: Array<{ eventId: string; eventType: string; eventTime: string | null }>,
): HistorySummary {
	const eventTypeCounts: Record<string, number> = {};
	const milestoneTypes = [
		'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED',
		'EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED',
		'EVENT_TYPE_WORKFLOW_EXECUTION_FAILED',
		'EVENT_TYPE_WORKFLOW_EXECUTION_TIMED_OUT',
		'EVENT_TYPE_WORKFLOW_EXECUTION_CANCELED',
		'EVENT_TYPE_WORKFLOW_EXECUTION_TERMINATED',
		'EVENT_TYPE_WORKFLOW_EXECUTION_CONTINUED_AS_NEW',
		'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED',
		'EVENT_TYPE_ACTIVITY_TASK_COMPLETED',
		'EVENT_TYPE_ACTIVITY_TASK_FAILED',
		'EVENT_TYPE_TIMER_STARTED',
		'EVENT_TYPE_TIMER_FIRED',
		'EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_STARTED',
	];
	const milestones: HistorySummary['milestones'] = [];

	for (const event of events) {
		eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] ?? 0) + 1;
		if (milestoneTypes.includes(event.eventType)) {
			milestones.push({ eventId: event.eventId, eventType: event.eventType, eventTime: event.eventTime });
		}
	}

	return { totalEvents: events.length, eventTypeCounts, milestones };
}

function extractAttributes(event: any): Record<string, unknown> {
	for (const key of Object.keys(event)) {
		if (key.endsWith('EventAttributes') && event[key] != null) {
			return event[key];
		}
	}
	return {};
}
