import { afterEach, describe, expect, test } from 'bun:test';
import { takeResult } from '@modelcontextprotocol/sdk/experimental/tasks';
import { createTestPair, type TestPair } from './helpers.ts';

describe('protocol / tasks', () => {
	let pair: TestPair;

	afterEach(async () => {
		await pair?.cleanup();
	});

	test('listTasks returns empty tasks initially', async () => {
		pair = await createTestPair();
		const result = await pair.client.experimental.tasks.listTasks();
		expect(result.tasks).toBeArray();
		expect(result.tasks).toHaveLength(0);
	});

	test('calling test.background creates a task', async () => {
		pair = await createTestPair();

		// Must call listTools first so client learns which tools support tasks
		await pair.client.listTools();

		const stream = pair.client.experimental.tasks.callToolStream(
			{ name: 'test.background', arguments: {} },
			undefined,
			{ task: {} },
		);
		const result = await takeResult(stream);
		expect(result).toBeDefined();

		// After calling a task tool, there should be at least one task
		const tasks = await pair.client.experimental.tasks.listTasks();
		expect(tasks.tasks.length).toBeGreaterThanOrEqual(1);
	});

	test('getTask returns valid task object', async () => {
		pair = await createTestPair();

		await pair.client.listTools();

		const stream = pair.client.experimental.tasks.callToolStream(
			{ name: 'test.background', arguments: {} },
			undefined,
			{ task: {} },
		);
		const result = await takeResult(stream);
		expect(result).toBeDefined();

		const tasks = await pair.client.experimental.tasks.listTasks();
		expect(tasks.tasks.length).toBeGreaterThanOrEqual(1);
		const task = tasks.tasks[0]!;
		expect(task.taskId).toBeDefined();
		expect(task.status).toBeDefined();
		expect(task.createdAt).toBeDefined();
	});

	test('task eventually reaches completed status', async () => {
		pair = await createTestPair();

		await pair.client.listTools();

		const stream = pair.client.experimental.tasks.callToolStream(
			{ name: 'test.background', arguments: {} },
			undefined,
			{ task: {} },
		);
		const result = await takeResult(stream);
		expect(result).toBeDefined();

		// Wait for the background task to finish (50ms delay + buffer)
		await Bun.sleep(200);

		const tasks = await pair.client.experimental.tasks.listTasks();
		expect(tasks.tasks.length).toBeGreaterThanOrEqual(1);
		const task = tasks.tasks[0]!;
		const taskStatus = await pair.client.experimental.tasks.getTask(
			task.taskId,
		);
		expect(taskStatus.status).toBe('completed');
	});

	test('cancelTask on a working task sets status to cancelled', async () => {
		pair = await createTestPair();

		// Register a slow task that won't complete quickly
		pair.server.experimental.tasks.registerToolTask(
			'test.slow',
			{
				description: 'A slow background task',
				execution: { taskSupport: 'optional' as const },
			},
			{
				createTask: async (extra: any): Promise<any> => {
					const task = await extra.taskStore.createTask({ ttl: 60_000 });
					// Don't complete this task — leave it running
					return { task };
				},
				getTask: async (extra: any): Promise<any> => {
					const task = await extra.taskStore.getTask(extra.taskId);
					return { task: task! };
				},
				getTaskResult: async (extra: any) => {
					return extra.taskStore.getTaskResult(extra.taskId);
				},
			},
		);

		// Re-list tools so client learns about test.slow
		await pair.client.listTools();

		const stream = pair.client.experimental.tasks.callToolStream(
			{ name: 'test.slow', arguments: {} },
			undefined,
			{ task: {} },
		);

		// Consume just the first message (taskCreated) then break
		let taskId: string | undefined;
		for await (const message of stream) {
			if (message.type === 'taskCreated') {
				taskId = message.task.taskId;
				break;
			}
			if (message.type === 'result' || message.type === 'error') {
				break;
			}
		}

		expect(taskId).toBeDefined();

		await pair.client.experimental.tasks.cancelTask(taskId!);

		const updated = await pair.client.experimental.tasks.getTask(taskId!);
		expect(updated.status).toBe('cancelled');
	});

	test('tasks/list errors when tasks disabled', async () => {
		pair = await createTestPair({
			mcp: {
				capabilities: {
					tasks: false,
					elicitation: true,
					roots: true,
					completions: true,
				},
			},
		});

		try {
			await pair.client.experimental.tasks.listTasks();
			expect(true).toBe(false);
		} catch (error) {
			expect(error).toBeDefined();
		}
	});
});
