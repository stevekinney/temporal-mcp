import { describe, expect, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { listWorkflows } from '../src/tools/workflow/list.ts';

interface MockWorkflow {
	workflowId: string;
	runId: string;
	type: string;
	status: { name: string };
	startTime: Date;
	closeTime?: Date | null;
}

function createMockClient(workflows: MockWorkflow[]) {
	return {
		workflow: {
			list: () =>
				(async function* () {
					for (const workflow of workflows) yield workflow;
				})(),
		},
	} as unknown as Client;
}

function makeWorkflow(overrides: Partial<MockWorkflow> = {}): MockWorkflow {
	return {
		workflowId: 'wf-1',
		runId: 'run-1',
		type: 'TestWorkflow',
		status: { name: 'RUNNING' },
		startTime: new Date('2026-01-01T00:00:00Z'),
		closeTime: null,
		...overrides,
	};
}

describe('listWorkflows', () => {
	test('returns empty array when no workflows exist', async () => {
		const client = createMockClient([]);
		const result = await listWorkflows(client, { pageSize: 10 });
		expect(result).toEqual([]);
	});

	test('returns all workflows when count is within pageSize', async () => {
		const workflows = [
			makeWorkflow({ workflowId: 'wf-1', runId: 'run-1' }),
			makeWorkflow({ workflowId: 'wf-2', runId: 'run-2' }),
		];
		const client = createMockClient(workflows);
		const result = await listWorkflows(client, { pageSize: 10 });
		expect(result).toHaveLength(2);
		expect(result[0]!.workflowId).toBe('wf-1');
		expect(result[1]!.workflowId).toBe('wf-2');
	});

	test('truncates results at the pageSize boundary', async () => {
		const workflows = Array.from({ length: 5 }, (_, i) =>
			makeWorkflow({ workflowId: `wf-${i}`, runId: `run-${i}` }),
		);
		const client = createMockClient(workflows);
		const result = await listWorkflows(client, { pageSize: 3 });
		expect(result).toHaveLength(3);
		expect(result[2]!.workflowId).toBe('wf-2');
	});

	test('passes query option through to client.workflow.list()', async () => {
		let capturedQuery: string | undefined;
		const client = {
			workflow: {
				list: (options?: { query?: string }) => {
					capturedQuery = options?.query;
					return (async function* () {})();
				},
			},
		} as unknown as Client;

		await listWorkflows(client, { query: "WorkflowType='Foo'", pageSize: 10 });
		expect(capturedQuery).toBe("WorkflowType='Foo'");
	});

	test('maps closeTime to null when absent', async () => {
		const client = createMockClient([makeWorkflow({ closeTime: null })]);
		const result = await listWorkflows(client, { pageSize: 10 });
		expect(result[0]!.closeTime).toBeNull();
	});

	test('maps closeTime to ISO string when present', async () => {
		const closeTime = new Date('2026-01-02T12:00:00Z');
		const client = createMockClient([makeWorkflow({ closeTime })]);
		const result = await listWorkflows(client, { pageSize: 10 });
		expect(result[0]!.closeTime).toBe('2026-01-02T12:00:00.000Z');
	});

	test('converts status.name to a string', async () => {
		const client = createMockClient([
			makeWorkflow({ status: { name: 'COMPLETED' } }),
		]);
		const result = await listWorkflows(client, { pageSize: 10 });
		expect(result[0]!.status).toBe('COMPLETED');
		expect(typeof result[0]!.status).toBe('string');
	});
});
