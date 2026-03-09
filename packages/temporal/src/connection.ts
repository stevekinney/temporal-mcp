import { Client, Connection } from '@temporalio/client';
import type {
	TemporalConfig,
	TemporalProfileConfig,
} from '../../server/src/contracts/config.ts';
import type { ErrorEnvelope } from '../../server/src/contracts/error-envelope.ts';

export class TemporalConnectionManager {
	private clients = new Map<string, Client>();
	private config: TemporalConfig;

	constructor(config: TemporalConfig) {
		this.config = config;
	}

	async getClient(profileName?: string): Promise<Client> {
		const name = profileName ?? this.config.defaultProfile;

		if (!name) {
			throw this.createError(
				'PROFILE_NOT_SPECIFIED',
				'No profile name provided and no default profile configured',
			);
		}

		const profile = this.config.profiles[name];

		if (!profile) {
			throw this.createError(
				'PROFILE_NOT_FOUND',
				`Profile "${name}" not found. Available profiles: ${Object.keys(this.config.profiles).join(', ') || '(none)'}`,
			);
		}

		const cached = this.clients.get(name);
		if (cached) return cached;

		const client = await this.connect(profile);
		this.clients.set(name, client);
		return client;
	}

	private async connect(profile: TemporalProfileConfig): Promise<Client> {
		const connectionOptions: { address: string; apiKey?: string } = {
			address: profile.address,
		};

		if (profile.kind === 'cloud') {
			const apiKey = process.env.TEMPORAL_API_KEY;
			if (!apiKey) {
				throw this.createError(
					'MISSING_API_KEY',
					'TEMPORAL_API_KEY environment variable is required for cloud profiles',
				);
			}
			connectionOptions.apiKey = apiKey;
		}

		const connection = await Connection.connect(connectionOptions);
		return new Client({ connection, namespace: profile.namespace });
	}

	private createError(code: string, message: string): ErrorEnvelope {
		return {
			ok: false,
			error: { code, message, retryable: false },
		};
	}
}
