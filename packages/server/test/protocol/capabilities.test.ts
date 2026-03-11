import { afterEach, describe, expect, test } from 'bun:test';
import { createTestPair, type TestPair } from './helpers.ts';

describe('protocol / capabilities', () => {
	let pair: TestPair;

	afterEach(async () => {
		await pair?.cleanup();
	});

	test('default config advertises tools with listChanged', async () => {
		pair = await createTestPair();
		const capabilities = pair.client.getServerCapabilities()!;
		expect(capabilities.tools).toBeDefined();
		expect(capabilities.tools!.listChanged).toBe(true);
	});

	test('default config advertises logging', async () => {
		pair = await createTestPair();
		const capabilities = pair.client.getServerCapabilities()!;
		expect(capabilities.logging).toBeDefined();
	});

	test('default config advertises tasks capability', async () => {
		pair = await createTestPair();
		const capabilities = pair.client.getServerCapabilities()!;
		expect(capabilities.tasks).toBeDefined();
		expect(capabilities.tasks!.list).toBeDefined();
		expect(capabilities.tasks!.cancel).toBeDefined();
		expect(capabilities.tasks!.requests).toBeDefined();
		expect(capabilities.tasks!.requests!.tools).toBeDefined();
	});

	test('tasks capability absent when tasks disabled', async () => {
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
		const capabilities = pair.client.getServerCapabilities()!;
		expect(capabilities.tasks).toBeUndefined();
	});

});
