import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfigContract } from './contracts/config.ts';

const SERVER_NAME = 'temporal-mcp';
const SERVER_VERSION = '0.1.0';

export interface CreateServerOptions {
	config: AppConfigContract;
}

export function createServer(options: CreateServerOptions): McpServer {
	const { config } = options;

	const server = new McpServer(
		{ name: SERVER_NAME, version: SERVER_VERSION },
		{
			capabilities: {
				tools: { listChanged: true },
				logging: {},
				...(config.mcp.capabilities.roots ? { roots: { listChanged: true } } : {}),
			},
			instructions:
				'Temporal MCP server for inspecting and managing Temporal workflow executions, schedules, task queues, and namespaces. Use read-only tools to inspect state. Policy configuration controls which operations are allowed.',
		},
	);

	return server;
}
