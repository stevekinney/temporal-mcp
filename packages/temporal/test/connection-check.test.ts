import { describe, expect, mock, test } from 'bun:test';
import type { TemporalConnectionManager } from '../src/connection.ts';
import { checkConnection } from '../src/tools/connection-check.ts';

function createMockConnectionManager(overrides: Record<string, unknown> = {}) {
	return {
		getClient: mock(() => Promise.resolve(overrides.client ?? {})),
		...overrides,
	} as unknown as TemporalConnectionManager;
}

describe('checkConnection', () => {
	test('returns connected with server info on success', async () => {
		const mockClient = {
			workflowService: {
				getSystemInfo: mock(() =>
					Promise.resolve({
						serverVersion: '1.24.0',
						capabilities: {
							supportsSchedules: true,
						},
					}),
				),
			},
		};
		const manager = createMockConnectionManager({ client: mockClient });

		const result = await checkConnection(manager, 'local');
		expect(result.connected).toBe(true);
		expect(result.profile).toBe('local');
		expect(result.serverInfo).not.toBeNull();
		expect(result.serverInfo!.serverVersion).toBe('1.24.0');
		expect(result.error).toBeNull();
	});

	test('returns disconnected with error message on Error throw', async () => {
		const manager = {
			getClient: mock(() => Promise.reject(new Error('Connection refused'))),
		} as unknown as TemporalConnectionManager;

		const result = await checkConnection(manager, 'local');
		expect(result.connected).toBe(false);
		expect(result.profile).toBe('local');
		expect(result.serverInfo).toBeNull();
		expect(result.error).toBe('Connection refused');
	});

	test('returns disconnected with error message from ErrorEnvelope', async () => {
		const manager = {
			getClient: mock(() =>
				Promise.reject({
					ok: false,
					error: { code: 'PROFILE_NOT_FOUND', message: 'Profile "missing" not found', retryable: false },
				}),
			),
		} as unknown as TemporalConnectionManager;

		const result = await checkConnection(manager, 'missing');
		expect(result.connected).toBe(false);
		expect(result.error).toBe('Profile "missing" not found');
	});

	test('defaults profile to "default" when not provided', async () => {
		const manager = {
			getClient: mock(() => Promise.reject(new Error('fail'))),
		} as unknown as TemporalConnectionManager;

		const result = await checkConnection(manager);
		expect(result.profile).toBe('default');
	});

	test('handles unknown error types', async () => {
		const manager = {
			getClient: mock(() => Promise.reject('string-error')),
		} as unknown as TemporalConnectionManager;

		const result = await checkConnection(manager);
		expect(result.connected).toBe(false);
		expect(result.error).toBe('Unknown error');
	});
});
