import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
	InMemoryTaskStore,
	InMemoryTaskMessageQueue,
} from '@modelcontextprotocol/sdk/experimental/tasks';
import type { AppConfigContract } from './contracts/config.ts';

const SERVER_NAME = 'temporal-mcp';
const SERVER_VERSION = '0.1.0';

export interface CreateServerOptions {
	config: AppConfigContract;
}

export interface CreateServerResult {
	server: McpServer;
	taskStore: InMemoryTaskStore | undefined;
}

export function createServer(options: CreateServerOptions): CreateServerResult {
	const { config } = options;

	const tasksEnabled = config.mcp.capabilities.tasks;
	const taskStore = tasksEnabled ? new InMemoryTaskStore() : undefined;
	const taskMessageQueue = tasksEnabled
		? new InMemoryTaskMessageQueue()
		: undefined;

	const server = new McpServer(
		{ name: SERVER_NAME, version: SERVER_VERSION },
		{
			capabilities: {
				tools: { listChanged: true },
				logging: {},
				...(config.mcp.capabilities.roots
					? { roots: { listChanged: true } }
					: {}),
				...(tasksEnabled
					? {
							tasks: {
								list: {},
								cancel: {},
								requests: { tools: { call: {} } },
							},
						}
					: {}),
			},
			instructions:
				'Temporal MCP server for inspecting and managing Temporal workflow executions, schedules, task queues, and namespaces. Use read-only tools to inspect state. Policy configuration controls which operations are allowed.',
			taskStore,
			taskMessageQueue,
		},
	);

	return { server, taskStore };
}
