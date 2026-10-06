import { describe, expect, mock, test } from 'bun:test';
import {
	TemporalConnectionManager,
	createCodecDataConverter,
} from '../src/connection.ts';
import { RemotePayloadCodec } from '../src/payload-codec.ts';
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

describe('createCodecDataConverter', () => {
	const profile: TemporalProfileConfig = {
		kind: 'self-hosted',
		address: 'localhost:7233',
		namespace: 'default',
	};

	test('returns no converter when the profile has no codec endpoint', () => {
		expect(createCodecDataConverter(profile)).toBeUndefined();
	});

	test('installs a remote codec when the profile names an endpoint', () => {
		const converter = createCodecDataConverter({
			...profile,
			codecEndpoint: 'https://codec.example.com',
		});

		expect(converter?.payloadCodecs).toHaveLength(1);
		expect(converter?.payloadCodecs?.[0]).toBeInstanceOf(
			RemotePayloadCodec,
		);
	});

	test('passes the security allowlist through to the codec', async () => {
		const endpoint = 'http://localhost:8080';
		const converter = createCodecDataConverter(
			{ ...profile, codecEndpoint: endpoint },
			{ codecAllowlist: [endpoint] },
		);
		const codec = converter!.payloadCodecs![0]!;

		const originalFetch = globalThis.fetch;
		const fetchMock = mock(async (_url: string, _init?: unknown) =>
			Response.json({ payloads: [{ metadata: {}, data: '' }] }),
		);
		globalThis.fetch = fetchMock as any;

		try {
			await codec.decode([
				{
					metadata: {
						encoding: new TextEncoder().encode('binary/encrypted'),
					},
					data: new Uint8Array([1]),
				},
			]);
		} finally {
			globalThis.fetch = originalFetch;
		}

		expect(fetchMock).toHaveBeenCalled();
		expect(fetchMock.mock.calls[0]![0]).toBe(`${endpoint}/decode`);
	});

	test('rejects a private codec endpoint that is not allowlisted', async () => {
		const converter = createCodecDataConverter({
			...profile,
			codecEndpoint: 'http://localhost:8080',
		});
		const codec = converter!.payloadCodecs![0]!;

		await expect(
			codec.decode([
				{
					metadata: {
						encoding: new TextEncoder().encode('binary/encrypted'),
					},
					data: new Uint8Array([1]),
				},
			]),
		).rejects.toThrow(/private address/);
	});
});

describe('TemporalConnectionManager codec configuration', () => {
	test('keeps codec security options optional', () => {
		const config: TemporalConfig = {
			defaultProfile: 'local',
			profiles: {
				local: {
					kind: 'self-hosted',
					address: 'localhost:7233',
					namespace: 'default',
					codecEndpoint: 'https://codec.example.com',
				},
			},
		};

		const manager = new TemporalConnectionManager(config);
		expect(manager.getProfileConfiguration().codecEndpoint).toBe(
			'https://codec.example.com',
		);
	});
});
