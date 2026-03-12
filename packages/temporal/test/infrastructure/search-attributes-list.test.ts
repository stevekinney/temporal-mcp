import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { listSearchAttributesTool } from '../../src/tools/infrastructure/search-attributes-list.ts';

function createMockClient(response: Record<string, unknown> = { customAttributes: {}, systemAttributes: {} }) {
	const grpcFn = mock(() => Promise.resolve(response));
	return {
		client: {
			connection: {
				operatorService: { listSearchAttributes: grpcFn },
			},
		} as unknown as Client,
		grpcFn,
	};
}

describe('listSearchAttributesTool', () => {
	test('delegates to grpc listSearchAttributes', async () => {
		const { client, grpcFn } = createMockClient();
		await listSearchAttributesTool(client, { namespace: 'default' });

		expect(grpcFn).toHaveBeenCalledWith({ namespace: 'default' });
	});

	test('returns search attribute lists', async () => {
		const { client } = createMockClient({
			customAttributes: {
				CustomField: 'INDEXED_VALUE_TYPE_KEYWORD',
			},
			systemAttributes: {
				WorkflowId: 'INDEXED_VALUE_TYPE_KEYWORD',
			},
		});

		const result = await listSearchAttributesTool(client, { namespace: 'default' });
		expect(result.customAttributes).toEqual({ CustomField: 'INDEXED_VALUE_TYPE_KEYWORD' });
		expect(result.systemAttributes).toEqual({ WorkflowId: 'INDEXED_VALUE_TYPE_KEYWORD' });
	});

	test('handles null attributes gracefully', async () => {
		const { client } = createMockClient({
			customAttributes: null,
			systemAttributes: undefined,
		});

		const result = await listSearchAttributesTool(client, { namespace: 'default' });
		expect(result.customAttributes).toEqual({});
		expect(result.systemAttributes).toEqual({});
	});
});
