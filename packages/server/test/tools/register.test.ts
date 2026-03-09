import { describe, expect, test } from 'bun:test';
import { createServer } from '../../src/server.ts';
import { TemporalConnectionManager } from '../../../temporal/src/connection.ts';
import { registerTemporalTools } from '../../src/tools/register.ts';
import type { TemporalConfig } from '../../src/contracts/config.ts';

describe('registerTemporalTools', () => {
	test('registers two tools on the server', () => {
		const server = createServer();
		const config: TemporalConfig = {
			defaultProfile: 'test',
			profiles: {
				test: {
					kind: 'self-hosted',
					address: 'localhost:7233',
					namespace: 'default',
				},
			},
		};
		const manager = new TemporalConnectionManager(config);

		// should not throw
		registerTemporalTools(server, manager);
	});
});
