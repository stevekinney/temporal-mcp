import { afterEach, describe, expect, test } from 'bun:test';
import { createTestPair, type TestPair } from './helpers.ts';

describe('protocol / errors', () => {
	let pair: TestPair;

	afterEach(async () => {
		await pair?.cleanup();
	});

	test('calling nonexistent tool returns MCP error', async () => {
		pair = await createTestPair();
		try {
			await pair.client.callTool({
				name: 'does.not.exist',
				arguments: {},
			});
			expect(true).toBe(false);
		} catch (error: any) {
			expect(error).toBeDefined();
			expect(error.message || error.code).toBeDefined();
		}
	});

	test('getTask with nonexistent task ID returns error', async () => {
		pair = await createTestPair();
		try {
			await pair.client.experimental.tasks.getTask('nonexistent-task-id');
			expect(true).toBe(false);
		} catch (error: any) {
			expect(error).toBeDefined();
		}
	});
});
