import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { queryWorkflow } from '../../src/tools/workflow/query.ts';

function createMockClient(queryResult: unknown) {
	const queryFn = mock((..._args: unknown[]) => Promise.resolve(queryResult));
	const getHandle = mock((_workflowId: string, _runId?: string) => ({
		query: queryFn,
	}));
	const client = {
		workflow: { getHandle },
	} as unknown as Client;
	return { client, getHandle, queryFn };
}

describe('queryWorkflow', () => {
	test('returns the query result', async () => {
		const { client } = createMockClient({ value: 42 });
		const result = await queryWorkflow(client, {
			workflowId: 'wf-1',
			queryName: 'getStatus',
		});
		expect(result).toEqual({ value: 42 });
	});

	test('passes workflowId and runId to getHandle', async () => {
		const { client, getHandle } = createMockClient('ok');
		await queryWorkflow(client, {
			workflowId: 'wf-1',
			runId: 'run-1',
			queryName: 'getStatus',
		});
		expect(getHandle).toHaveBeenCalledWith('wf-1', 'run-1');
	});

	test('passes undefined runId when not provided', async () => {
		const { client, getHandle } = createMockClient('ok');
		await queryWorkflow(client, {
			workflowId: 'wf-1',
			queryName: 'getStatus',
		});
		expect(getHandle).toHaveBeenCalledWith('wf-1', undefined);
	});

	test('passes query name and args to handle.query', async () => {
		const { client, queryFn } = createMockClient('result');
		await queryWorkflow(client, {
			workflowId: 'wf-1',
			queryName: 'getProgress',
			args: ['arg1', 123],
		});
		expect(queryFn).toHaveBeenCalledWith('getProgress', 'arg1', 123);
	});

	test('passes query name with no args when args omitted', async () => {
		const { client, queryFn } = createMockClient('result');
		await queryWorkflow(client, {
			workflowId: 'wf-1',
			queryName: 'getStatus',
		});
		expect(queryFn).toHaveBeenCalledWith('getStatus');
	});
});
