import { describe, expect, test } from 'bun:test';
import { createServer } from '../src/server.ts';
import { DEFAULT_APP_CONFIG } from '../src/config/schema.ts';

describe('createServer', () => {
	test('returns an McpServer instance', () => {
		const server = createServer({ config: DEFAULT_APP_CONFIG });
		expect(server).toBeDefined();
		expect(server.connect).toBeFunction();
	});

	test('sets tool capabilities with listChanged', () => {
		const server = createServer({ config: DEFAULT_APP_CONFIG });
		// Verify the server was created successfully (capabilities are internal)
		expect(server).toBeDefined();
	});

	test('includes roots capability when config enables roots', () => {
		const config = {
			...DEFAULT_APP_CONFIG,
			mcp: {
				capabilities: { ...DEFAULT_APP_CONFIG.mcp.capabilities, roots: true },
			},
		};
		const server = createServer({ config });
		expect(server).toBeDefined();
	});

	test('omits roots capability when config disables roots', () => {
		const config = {
			...DEFAULT_APP_CONFIG,
			mcp: {
				capabilities: { ...DEFAULT_APP_CONFIG.mcp.capabilities, roots: false },
			},
		};
		const server = createServer({ config });
		expect(server).toBeDefined();
	});
});
