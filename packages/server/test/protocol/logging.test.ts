import { afterEach, describe, expect, test } from 'bun:test';
import { createTestPair, type TestPair } from './helpers.ts';

describe('protocol / logging', () => {
	let pair: TestPair;

	afterEach(async () => {
		await pair?.cleanup();
	});

	test('setLoggingLevel succeeds', async () => {
		pair = await createTestPair();
		const result = await pair.client.setLoggingLevel('info');
		expect(result).toBeDefined();
	});

	test('server logging messages reach client notification handler', async () => {
		pair = await createTestPair();

		const messages: Array<{ level: string; data: unknown }> = [];

		pair.client.fallbackNotificationHandler = async (notification: any) => {
			if (notification.method === 'notifications/message') {
				messages.push({
					level: notification.params.level,
					data: notification.params.data,
				});
			}
		};

		await pair.client.setLoggingLevel('info');

		// Send a logging message from the server
		await pair.server.sendLoggingMessage({
			level: 'info',
			data: 'test log message',
		});

		// Give the notification time to propagate
		await Bun.sleep(50);

		expect(messages.length).toBeGreaterThanOrEqual(1);
		expect(messages[0]!.level).toBe('info');
		expect(messages[0]!.data).toBe('test log message');
	});
});
