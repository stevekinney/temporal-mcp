import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../packages/server/src/server.ts';
import { loadConfiguration } from '../packages/server/src/config/load.ts';
import { TemporalConnectionManager } from '../packages/temporal/src/connection.ts';
import { registerTemporalTools } from '../packages/server/src/tools/register.ts';

async function main() {
	console.error('[temporal-mcp] Starting server...');

	const config = await loadConfiguration();

	const connectionManager = new TemporalConnectionManager(config.temporal);
	const server = createServer();

	registerTemporalTools(server, connectionManager);

	const transport = new StdioServerTransport();
	await server.connect(transport);

	const profileCount = Object.keys(config.temporal.profiles).length;
	console.error(
		`[temporal-mcp] Server ready (${profileCount} profile${profileCount !== 1 ? 's' : ''} configured)`,
	);
}

main().catch((error) => {
	console.error('[temporal-mcp] Fatal error:', error);
	process.exit(1);
});
