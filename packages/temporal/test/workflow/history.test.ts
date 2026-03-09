import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { getWorkflowHistory, summarizeWorkflowHistory } from '../../src/tools/workflow/history.ts';

function createMockClient(historyEvents: any[]) {
	const fetchHistory = mock(() =>
		Promise.resolve({
			events: historyEvents,
		}),
	);
	const getHandle = mock((_workflowId: string, _runId?: string) => ({
		fetchHistory,
	}));
	const client = {
		workflow: { getHandle },
	} as unknown as Client;
	return { client, getHandle, fetchHistory };
}

describe('getWorkflowHistory', () => {
	test('returns mapped events from history', async () => {
		const events = [
			{
				eventId: 1,
				eventType: 'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED',
				eventTime: { toISOString: () => '2026-01-01T00:00:00.000Z' },
				taskId: 100,
				workflowExecutionStartedEventAttributes: {
					workflowType: { name: 'MyWorkflow' },
				},
			},
			{
				eventId: 2,
				eventType: 'EVENT_TYPE_WORKFLOW_TASK_SCHEDULED',
				eventTime: { toISOString: () => '2026-01-01T00:00:01.000Z' },
				taskId: 101,
			},
		];
		const { client } = createMockClient(events);
		const result = (await getWorkflowHistory(client, { workflowId: 'wf-1' })) as any;

		expect(result.events).toHaveLength(2);
		expect(result.events[0].eventId).toBe('1');
		expect(result.events[0].eventType).toBe('EVENT_TYPE_WORKFLOW_EXECUTION_STARTED');
		expect(result.events[0].eventTime).toBe('2026-01-01T00:00:00.000Z');
		expect(result.events[0].attributes).toEqual({
			workflowType: { name: 'MyWorkflow' },
		});
	});

	test('passes workflowId and runId to getHandle', async () => {
		const { client, getHandle } = createMockClient([]);
		await getWorkflowHistory(client, { workflowId: 'wf-1', runId: 'run-1' });
		expect(getHandle).toHaveBeenCalledWith('wf-1', 'run-1');
	});

	test('handles empty history', async () => {
		const { client } = createMockClient([]);
		const result = (await getWorkflowHistory(client, { workflowId: 'wf-1' })) as any;
		expect(result.events).toEqual([]);
	});

	test('handles null events in history', async () => {
		const fetchHistory = mock(() => Promise.resolve({ events: null }));
		const getHandle = mock(() => ({ fetchHistory }));
		const client = { workflow: { getHandle } } as unknown as Client;

		const result = (await getWorkflowHistory(client, { workflowId: 'wf-1' })) as any;
		expect(result.events).toEqual([]);
	});

	test('handles event with null eventTime', async () => {
		const events = [
			{
				eventId: 1,
				eventType: 'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED',
				eventTime: null,
				taskId: 100,
			},
		];
		const { client } = createMockClient(events);
		const result = (await getWorkflowHistory(client, { workflowId: 'wf-1' })) as any;
		expect(result.events[0].eventTime).toBeNull();
	});
});

describe('summarizeWorkflowHistory', () => {
	test('counts event types correctly', () => {
		const events = [
			{ eventId: '1', eventType: 'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED', eventTime: null },
			{ eventId: '2', eventType: 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED', eventTime: null },
			{ eventId: '3', eventType: 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED', eventTime: null },
			{ eventId: '4', eventType: 'EVENT_TYPE_ACTIVITY_TASK_COMPLETED', eventTime: null },
			{ eventId: '5', eventType: 'EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED', eventTime: null },
		];

		const summary = summarizeWorkflowHistory(events);
		expect(summary.totalEvents).toBe(5);
		expect(summary.eventTypeCounts['EVENT_TYPE_ACTIVITY_TASK_SCHEDULED']).toBe(2);
		expect(summary.eventTypeCounts['EVENT_TYPE_ACTIVITY_TASK_COMPLETED']).toBe(1);
	});

	test('extracts milestone events', () => {
		const events = [
			{ eventId: '1', eventType: 'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED', eventTime: '2026-01-01T00:00:00Z' },
			{ eventId: '2', eventType: 'EVENT_TYPE_WORKFLOW_TASK_SCHEDULED', eventTime: '2026-01-01T00:00:01Z' },
			{ eventId: '3', eventType: 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED', eventTime: '2026-01-01T00:00:02Z' },
			{ eventId: '4', eventType: 'EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED', eventTime: '2026-01-01T00:01:00Z' },
		];

		const summary = summarizeWorkflowHistory(events);
		expect(summary.milestones).toHaveLength(3);
		expect(summary.milestones[0]!.eventType).toBe('EVENT_TYPE_WORKFLOW_EXECUTION_STARTED');
		expect(summary.milestones[1]!.eventType).toBe('EVENT_TYPE_ACTIVITY_TASK_SCHEDULED');
		expect(summary.milestones[2]!.eventType).toBe('EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED');
	});

	test('handles empty events array', () => {
		const summary = summarizeWorkflowHistory([]);
		expect(summary.totalEvents).toBe(0);
		expect(summary.eventTypeCounts).toEqual({});
		expect(summary.milestones).toEqual([]);
	});
});
