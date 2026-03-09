import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { getWorkflowResult } from '../../src/tools/workflow/result.ts';

function createMockClient(resultValue: unknown) {
	const resultFn = mock(() => Promise.resolve(resultValue));
	const getHandle = mock((_workflowId: string, _runId?: string) => ({
		result: resultFn,
	}));
	const client = {
		workflow: { getHandle },
	} as unknown as Client;
	return { client, getHandle, resultFn };
}

describe('getWorkflowResult', () => {
	test('returns the workflow result', async () => {
		const { client } = createMockClient({ output: 'success' });
		const result = await getWorkflowResult(client, { workflowId: 'wf-1' });
		expect(result).toEqual({ output: 'success' });
	});

	test('passes workflowId and runId to getHandle', async () => {
		const { client, getHandle } = createMockClient('done');
		await getWorkflowResult(client, { workflowId: 'wf-1', runId: 'run-1' });
		expect(getHandle).toHaveBeenCalledWith('wf-1', 'run-1');
	});

	test('passes undefined runId when not provided', async () => {
		const { client, getHandle } = createMockClient(null);
		await getWorkflowResult(client, { workflowId: 'wf-1' });
		expect(getHandle).toHaveBeenCalledWith('wf-1', undefined);
	});

	test('returns null when workflow result is null', async () => {
		const { client } = createMockClient(null);
		const result = await getWorkflowResult(client, { workflowId: 'wf-1' });
		expect(result).toBeNull();
	});

	test('returns primitive result values', async () => {
		const { client } = createMockClient(42);
		const result = await getWorkflowResult(client, { workflowId: 'wf-1' });
		expect(result).toBe(42);
	});
});
