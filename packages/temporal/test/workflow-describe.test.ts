import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { describeWorkflow } from '../src/tools/workflow-describe.ts';

interface MockDescription {
	workflowId: string;
	runId: string;
	type: string;
	status: { name: string };
	taskQueue: string;
	startTime: Date;
	closeTime?: Date | null;
	executionTime?: Date | null;
	historyLength: number | bigint;
	memo?: Record<string, unknown> | null;
	searchAttributes?: Record<string, unknown> | null;
	parentExecution?: { workflowId: string } | null;
}

function makeDescription(
	overrides: Partial<MockDescription> = {},
): MockDescription {
	return {
		workflowId: 'wf-1',
		runId: 'run-1',
		type: 'TestWorkflow',
		status: { name: 'RUNNING' },
		taskQueue: 'default',
		startTime: new Date('2026-01-01T00:00:00Z'),
		closeTime: new Date('2026-01-01T01:00:00Z'),
		executionTime: new Date('2026-01-01T00:00:01Z'),
		historyLength: 42,
		memo: { key: 'value' },
		searchAttributes: { attr: 'val' },
		parentExecution: { workflowId: 'parent-wf-1' },
		...overrides,
	};
}

function createMockClient(description: MockDescription) {
	const getHandle = mock((workflowId: string, _runId?: string) => ({
		describe: async () => description,
	}));

	const client = {
		workflow: { getHandle },
	} as unknown as Client;

	return { client, getHandle };
}

describe('describeWorkflow', () => {
	test('returns complete description with all fields populated', async () => {
		const { client } = createMockClient(makeDescription());
		const result = await describeWorkflow(client, { workflowId: 'wf-1' });

		expect(result).toEqual({
			workflowId: 'wf-1',
			runId: 'run-1',
			type: 'TestWorkflow',
			status: 'RUNNING',
			taskQueue: 'default',
			startTime: '2026-01-01T00:00:00.000Z',
			closeTime: '2026-01-01T01:00:00.000Z',
			executionTime: '2026-01-01T00:00:01.000Z',
			historyLength: 42,
			memo: { key: 'value' },
			searchAttributes: { attr: 'val' },
			parentWorkflowId: 'parent-wf-1',
		});
	});

	test('passes workflowId and runId to getHandle', async () => {
		const { client, getHandle } = createMockClient(makeDescription());
		await describeWorkflow(client, {
			workflowId: 'my-wf',
			runId: 'my-run',
		});

		expect(getHandle).toHaveBeenCalledWith('my-wf', 'my-run');
	});

	test('passes undefined for runId when not provided', async () => {
		const { client, getHandle } = createMockClient(makeDescription());
		await describeWorkflow(client, { workflowId: 'my-wf' });

		expect(getHandle).toHaveBeenCalledWith('my-wf', undefined);
	});

	test('maps closeTime to null when absent', async () => {
		const { client } = createMockClient(
			makeDescription({ closeTime: null }),
		);
		const result = await describeWorkflow(client, { workflowId: 'wf-1' });
		expect(result.closeTime).toBeNull();
	});

	test('maps executionTime to null when absent', async () => {
		const { client } = createMockClient(
			makeDescription({ executionTime: null }),
		);
		const result = await describeWorkflow(client, { workflowId: 'wf-1' });
		expect(result.executionTime).toBeNull();
	});

	test('maps parentWorkflowId to null when no parent execution', async () => {
		const { client } = createMockClient(
			makeDescription({ parentExecution: null }),
		);
		const result = await describeWorkflow(client, { workflowId: 'wf-1' });
		expect(result.parentWorkflowId).toBeNull();
	});

	test('defaults memo to {} when undefined', async () => {
		const desc = makeDescription();
		desc.memo = undefined;
		const { client } = createMockClient(desc);
		const result = await describeWorkflow(client, { workflowId: 'wf-1' });
		expect(result.memo).toEqual({});
	});

	test('defaults searchAttributes to {} when undefined', async () => {
		const desc = makeDescription();
		desc.searchAttributes = undefined;
		const { client } = createMockClient(desc);
		const result = await describeWorkflow(client, { workflowId: 'wf-1' });
		expect(result.searchAttributes).toEqual({});
	});
});
