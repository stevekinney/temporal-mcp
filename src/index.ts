import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../packages/server/src/server.ts';
import { loadConfiguration } from '../packages/server/src/config/load.ts';
import { TemporalConnectionManager } from '../packages/temporal/src/connection.ts';
import { registerAllTools } from '../packages/server/src/tools/register-all.ts';
import { registerAllResources } from '../packages/server/src/resources/register.ts';
import { AuditLogger } from '../packages/server/src/safety/audit-log.ts';
import { RootsDiscovery } from '../packages/server/src/roots/discovery.ts';

async function main() {
	console.error('[temporal-mcp] Starting server...');

	const config = await loadConfiguration();

	const connectionManager = new TemporalConnectionManager(config.temporal);
	const server = createServer({ config });
	const auditLogger = new AuditLogger();

	registerAllTools({ server, connectionManager, config, auditLogger });
	registerAllResources({ server, connectionManager, config });

	const transport = new StdioServerTransport();
	await server.connect(transport);

	// Initialize roots discovery after connection
	const rootsDiscovery = new RootsDiscovery();
	await rootsDiscovery.initialize(server).catch(() => {
		// Roots not supported by client — that's fine
	});

	const profileCount = Object.keys(config.temporal.profiles).length;
	console.error(
		`[temporal-mcp] Server ready (${profileCount} profile${profileCount !== 1 ? 's' : ''} configured)`,
	);
}

main().catch((error) => {
	console.error('[temporal-mcp] Fatal error:', error);
	process.exit(1);
});
