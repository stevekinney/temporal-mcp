import { afterEach, describe, expect, test } from 'bun:test';
import { createTestPair, type TestPair } from './helpers.ts';

describe('protocol / tools', () => {
	let pair: TestPair;

	afterEach(async () => {
		await pair?.cleanup();
	});

	test('listTools returns array containing test.echo', async () => {
		pair = await createTestPair();
		const result = await pair.client.listTools();
		const names = result.tools.map((t) => t.name);
		expect(names).toContain('test.echo');
	});

	test('each tool has name, description, and inputSchema', async () => {
		pair = await createTestPair();
		const result = await pair.client.listTools();
		for (const tool of result.tools) {
			expect(typeof tool.name).toBe('string');
			expect(tool.name.length).toBeGreaterThan(0);
			expect(tool.inputSchema).toBeDefined();
			expect(tool.inputSchema.type).toBe('object');
		}
	});

	test('callTool test.echo returns matching text', async () => {
		pair = await createTestPair();
		const result = await pair.client.callTool({
			name: 'test.echo',
			arguments: { message: 'hello' },
		});
		expect(result.content).toBeArray();
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]!.type).toBe('text');
		expect(content[0]!.text).toBe('hello');
	});

	test('callTool test.error returns isError true', async () => {
		pair = await createTestPair();
		const result = await pair.client.callTool({
			name: 'test.error',
			arguments: {},
		});
		expect(result.isError).toBe(true);
	});

	test('calling nonexistent tool returns error', async () => {
		pair = await createTestPair();
		try {
			await pair.client.callTool({
				name: 'nonexistent.tool',
				arguments: {},
			});
			// Should not reach here
			expect(true).toBe(false);
		} catch (error) {
			expect(error).toBeDefined();
		}
	});
});
