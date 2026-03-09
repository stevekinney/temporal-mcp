import { describe, expect, test } from 'bun:test';
import { TemporalConnectionManager } from '../src/connection.ts';
import type {
	TemporalConfig,
	TemporalProfileConfig,
} from '../../server/src/contracts/config.ts';
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

describe('TemporalConnectionManager.getProfileConfiguration', () => {
	const localProfile: TemporalProfileConfig = {
		kind: 'self-hosted',
		address: 'localhost:7233',
		namespace: 'default',
	};

	const cloudProfile: TemporalProfileConfig = {
		kind: 'cloud',
		address: 'my-ns.tmprl.cloud:7233',
		namespace: 'my-ns',
	};

	test('returns the profile for a given name', () => {
		const config: TemporalConfig = {
			profiles: { local: localProfile, cloud: cloudProfile },
		};
		const manager = new TemporalConnectionManager(config);

		expect(manager.getProfileConfiguration('local')).toBe(localProfile);
		expect(manager.getProfileConfiguration('cloud')).toBe(cloudProfile);
	});

	test('uses default profile when no name is specified', () => {
		const config: TemporalConfig = {
			defaultProfile: 'local',
			profiles: { local: localProfile },
		};
		const manager = new TemporalConnectionManager(config);

		expect(manager.getProfileConfiguration()).toBe(localProfile);
	});

	test('throws PROFILE_NOT_SPECIFIED when no name and no default', () => {
		const config: TemporalConfig = { profiles: {} };
		const manager = new TemporalConnectionManager(config);

		try {
			manager.getProfileConfiguration();
			expect.unreachable('should have thrown');
		} catch (error) {
			const envelope = error as ErrorEnvelope;
			expect(envelope.ok).toBe(false);
			expect(envelope.error.code).toBe('PROFILE_NOT_SPECIFIED');
		}
	});

	test('throws PROFILE_NOT_FOUND for a nonexistent profile', () => {
		const config: TemporalConfig = {
			defaultProfile: 'missing',
			profiles: { local: localProfile },
		};
		const manager = new TemporalConnectionManager(config);

		try {
			manager.getProfileConfiguration('nonexistent');
			expect.unreachable('should have thrown');
		} catch (error) {
			const envelope = error as ErrorEnvelope;
			expect(envelope.ok).toBe(false);
			expect(envelope.error.code).toBe('PROFILE_NOT_FOUND');
			expect(envelope.error.message).toContain('nonexistent');
			expect(envelope.error.message).toContain('local');
		}
	});
});
