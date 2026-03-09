import { describe, expect, test } from 'bun:test';
import { TemporalConnectionManager } from '../src/connection.ts';
import type { TemporalConfig } from '../../server/src/contracts/config.ts';
import type { ErrorEnvelope } from '../../server/src/contracts/error-envelope.ts';

describe('TemporalConnectionManager', () => {
	test('throws PROFILE_NOT_SPECIFIED when no profile name and no default', async () => {
		const config: TemporalConfig = {
			profiles: {},
		};
		const manager = new TemporalConnectionManager(config);

		try {
			await manager.getClient();
			expect.unreachable('should have thrown');
		} catch (error) {
			const envelope = error as ErrorEnvelope;
			expect(envelope.ok).toBe(false);
			expect(envelope.error.code).toBe('PROFILE_NOT_SPECIFIED');
		}
	});

	test('throws PROFILE_NOT_FOUND for a nonexistent profile', async () => {
		const config: TemporalConfig = {
			defaultProfile: 'missing',
			profiles: {},
		};
		const manager = new TemporalConnectionManager(config);

		try {
			await manager.getClient();
			expect.unreachable('should have thrown');
		} catch (error) {
			const envelope = error as ErrorEnvelope;
			expect(envelope.ok).toBe(false);
			expect(envelope.error.code).toBe('PROFILE_NOT_FOUND');
			expect(envelope.error.message).toContain('missing');
		}
	});

	test('uses explicit profile name over default', async () => {
		const config: TemporalConfig = {
			defaultProfile: 'default-profile',
			profiles: {},
		};
		const manager = new TemporalConnectionManager(config);

		try {
			await manager.getClient('explicit');
			expect.unreachable('should have thrown');
		} catch (error) {
			const envelope = error as ErrorEnvelope;
			expect(envelope.ok).toBe(false);
			expect(envelope.error.code).toBe('PROFILE_NOT_FOUND');
			expect(envelope.error.message).toContain('explicit');
		}
	});

	test('resolves default profile name when none specified', async () => {
		const config: TemporalConfig = {
			defaultProfile: 'my-default',
			profiles: {},
		};
		const manager = new TemporalConnectionManager(config);

		try {
			await manager.getClient();
			expect.unreachable('should have thrown');
		} catch (error) {
			const envelope = error as ErrorEnvelope;
			// the error should reference the default profile name
			expect(envelope.error.message).toContain('my-default');
		}
	});
});
