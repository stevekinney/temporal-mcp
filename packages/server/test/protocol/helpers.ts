import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod/v4';
import { createServer, type CreateServerResult } from '../../src/server.ts';
import {
	DEFAULT_APP_CONFIG,
} from '../../src/config/schema.ts';
import type { AppConfigContract } from '../../src/contracts/config.ts';
import { inputSchema } from '../../src/tools/zod-compat.ts';

export interface TestPair {
	server: CreateServerResult['server'];
	taskStore: CreateServerResult['taskStore'];
	client: Client;
	clientTransport: InMemoryTransport;
	serverTransport: InMemoryTransport;
	cleanup: () => Promise<void>;
}

export function createTestConfig(
	overrides: Partial<AppConfigContract> = {},
): AppConfigContract {
	return {
		...DEFAULT_APP_CONFIG,
		...overrides,
		mcp: {
			...DEFAULT_APP_CONFIG.mcp,
			...(overrides.mcp ?? {}),
			capabilities: {
				...DEFAULT_APP_CONFIG.mcp.capabilities,
				...(overrides.mcp?.capabilities ?? {}),
			},
		},
	};
}

export async function createTestPair(
	configOverrides: Partial<AppConfigContract> = {},
): Promise<TestPair> {
	const config = createTestConfig(configOverrides);
	const { server, taskStore } = createServer({ config });

	// Register lightweight stub tools
	server.registerTool(
		'test.echo',
		{
			description: 'Echoes back the message',
			inputSchema: inputSchema({
				message: z.string().describe('Message to echo'),
			}),
		},
		async ({ message }: any) => ({
			content: [{ type: 'text' as const, text: message }],
		}),
	);

	server.registerTool(
		'test.error',
		{
			description: 'Always returns an error',
			inputSchema: {},
		},
		async () => ({
			content: [{ type: 'text' as const, text: 'Something went wrong' }],
			isError: true,
		}),
	);

	// Register a task-aware tool when tasks are enabled
	if (config.mcp.capabilities.tasks && taskStore) {
		server.experimental.tasks.registerToolTask(
			'test.background',
			{
				description: 'A background task for testing',
				execution: { taskSupport: 'optional' as const },
			},
			{
				createTask: async (extra: any): Promise<any> => {
					const task = await extra.taskStore.createTask({ ttl: 60_000 });

					// Complete in background after a short delay
					setTimeout(async () => {
						try {
							await taskStore.storeTaskResult(task.taskId, 'completed', {
								content: [
									{
										type: 'text' as const,
										text: 'Background work done',
									},
								],
							});
						} catch {
							// Task may have been cancelled
						}
					}, 50);

					return { task };
				},
				getTask: async (extra: any): Promise<any> => {
					const task = await extra.taskStore.getTask(extra.taskId);
					return { task: task! };
				},
				getTaskResult: async (extra: any) => {
					return extra.taskStore.getTaskResult(extra.taskId);
				},
			},
		);
	}

	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();

	const client = new Client(
		{ name: 'test-client', version: '1.0.0' },
		{
			capabilities: {
				tasks: {
					list: {},
					cancel: {},
					requests: { tools: { call: {} } },
				},
			},
		},
	);

	await server.connect(serverTransport);
	await client.connect(clientTransport);

	const cleanup = async () => {
		await client.close();
		await server.close();
		taskStore?.cleanup();
	};

	return { server, taskStore, client, clientTransport, serverTransport, cleanup };
}
