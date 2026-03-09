import { describe, expect, test } from 'bun:test';
import { createServer } from '../src/server.ts';

describe('createServer', () => {
	test('returns an McpServer instance', () => {
		const server = createServer();
		expect(server).toBeDefined();
		expect(server.connect).toBeFunction();
	});
});
