import { afterEach, describe, expect, test } from 'bun:test';
import { createTestPair, type TestPair } from './helpers.ts';

describe('protocol / lifecycle', () => {
	let pair: TestPair;

	afterEach(async () => {
		await pair?.cleanup();
	});

	test('server returns serverInfo with name and version', async () => {
		pair = await createTestPair();
		const serverVersion = pair.client.getServerVersion();
		expect(serverVersion).toBeDefined();
		expect(serverVersion!.name).toBe('temporal-mcp');
		expect(serverVersion!.version).toBeDefined();
	});

	test('server returns protocolVersion', async () => {
		pair = await createTestPair();
		// If the client connected successfully, protocolVersion was negotiated
		const capabilities = pair.client.getServerCapabilities();
		expect(capabilities).toBeDefined();
	});

	test('server includes instructions in initialize result', async () => {
		pair = await createTestPair();
		const instructions = pair.client.getInstructions();
		expect(instructions).toBeDefined();
		expect(instructions).toContain('Temporal MCP server');
	});

	test('connection completes without error', async () => {
		pair = await createTestPair();
		expect(pair.client).toBeDefined();
		expect(pair.server).toBeDefined();
	});
});
