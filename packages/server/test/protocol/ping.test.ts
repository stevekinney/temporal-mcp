import { afterEach, describe, expect, test } from 'bun:test';
import { createTestPair, type TestPair } from './helpers.ts';

describe('protocol / ping', () => {
	let pair: TestPair;

	afterEach(async () => {
		await pair?.cleanup();
	});

	test('client.ping() resolves without error', async () => {
		pair = await createTestPair();
		const result = await pair.client.ping();
		expect(result).toBeDefined();
	});
});
