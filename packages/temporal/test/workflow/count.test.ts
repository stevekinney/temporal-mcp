import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { countWorkflows } from '../../src/tools/workflow/count.ts';

function createMockClient(countResult: { count: number; groups: Array<{ groupValues: unknown[]; count: number }> }) {
	const countFn = mock(() => Promise.resolve(countResult));
	const client = {
		workflow: { count: countFn },
	} as unknown as Client;
	return { client, countFn };
}

describe('countWorkflows', () => {
	test('returns count and empty groups when no groups exist', async () => {
		const { client } = createMockClient({ count: 42, groups: [] });
		const result = await countWorkflows(client, {});
		expect(result.count).toBe(42);
		expect(result.groups).toEqual([]);
	});

	test('returns count with groups', async () => {
		const { client } = createMockClient({
			count: 100,
			groups: [
				{ groupValues: ['RUNNING'], count: 60 },
				{ groupValues: ['COMPLETED'], count: 40 },
			],
		});
		const result = await countWorkflows(client, {});
		expect(result.count).toBe(100);
		expect(result.groups).toHaveLength(2);
		expect(result.groups[0]!.groupValues).toEqual(['RUNNING']);
		expect(result.groups[0]!.count).toBe(60);
	});

	test('passes query to client.workflow.count', async () => {
		const { client, countFn } = createMockClient({ count: 5, groups: [] });
		await countWorkflows(client, { query: "WorkflowType='MyWorkflow'" });
		expect(countFn).toHaveBeenCalledWith("WorkflowType='MyWorkflow'");
	});

	test('passes undefined query when not provided', async () => {
		const { client, countFn } = createMockClient({ count: 0, groups: [] });
		await countWorkflows(client, {});
		expect(countFn).toHaveBeenCalledWith(undefined);
	});
});
