import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { loadConfiguration } from '../../src/config/load.ts';
import { DEFAULT_APP_CONFIG } from '../../src/config/schema.ts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('loadConfiguration', () => {
	const originalEnv = process.env.TEMPORAL_MCP_CONFIG;
	const originalCwd = process.cwd();

	beforeEach(() => {
		delete process.env.TEMPORAL_MCP_CONFIG;
		// Change to a temp directory so the CWD candidate doesn't find
		// .temporal-mcp.json from the project root.
		process.chdir(tmpdir());
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (originalEnv !== undefined) {
			process.env.TEMPORAL_MCP_CONFIG = originalEnv;
		} else {
			delete process.env.TEMPORAL_MCP_CONFIG;
		}
	});

	test('returns defaults when no config file exists', async () => {
		process.env.TEMPORAL_MCP_CONFIG = '/nonexistent/path/config.json';
		const config = await loadConfiguration();
		expect(config).toEqual(DEFAULT_APP_CONFIG);
	});

	test('loads config from TEMPORAL_MCP_CONFIG env var', async () => {
		const configPath = join(tmpdir(), `temporal-mcp-test-${Date.now()}.json`);
		await Bun.write(
			configPath,
			JSON.stringify({
				temporal: {
					defaultProfile: 'test',
					profiles: {
						test: {
							kind: 'self-hosted',
							address: 'localhost:7233',
							namespace: 'test-ns',
						},
					},
				},
			}),
		);

		process.env.TEMPORAL_MCP_CONFIG = configPath;
		const config = await loadConfiguration();

		expect(config.temporal.defaultProfile).toBe('test');
		expect(config.temporal.profiles.test).toEqual({
			kind: 'self-hosted',
			address: 'localhost:7233',
			namespace: 'test-ns',
		});

		// defaults should be preserved for unspecified fields
		expect(config.mcp.capabilities).toEqual(
			DEFAULT_APP_CONFIG.mcp.capabilities,
		);
		expect(config.security).toEqual(DEFAULT_APP_CONFIG.security);
	});

	test('deep merges partial config over defaults', async () => {
		const configPath = join(tmpdir(), `temporal-mcp-test-${Date.now()}.json`);
		await Bun.write(
			configPath,
			JSON.stringify({
				security: {
					confirmTokenTtlSec: 300,
				},
			}),
		);

		process.env.TEMPORAL_MCP_CONFIG = configPath;
		const config = await loadConfiguration();

		expect(config.security.confirmTokenTtlSec).toBe(300);
		// other security fields should retain defaults
		expect(config.security.maxTaskTtlSec).toBe(3600);
		expect(config.security.codecAllowlist).toEqual([]);
		expect(config.security.idempotencyWindowSec).toBe(600);
	});

	test('rejects invalid config and falls back to defaults', async () => {
		const configPath = join(tmpdir(), `temporal-mcp-test-${Date.now()}.json`);
		await Bun.write(
			configPath,
			JSON.stringify({
				temporal: {
					profiles: {
						bad: {
							kind: 'invalidKind',
							address: 123,
						},
					},
				},
			}),
		);

		process.env.TEMPORAL_MCP_CONFIG = configPath;
		const config = await loadConfiguration();

		// should fall back to defaults since validation fails
		expect(config).toEqual(DEFAULT_APP_CONFIG);
	});
});
