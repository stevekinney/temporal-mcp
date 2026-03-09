import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const SERVER_NAME = 'temporal-mcp';
const SERVER_VERSION = '0.1.0';

export function createServer(): McpServer {
	return new McpServer({
		name: SERVER_NAME,
		version: SERVER_VERSION,
	});
}
