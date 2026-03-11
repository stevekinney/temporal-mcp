import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { InMemoryTaskStore } from '@modelcontextprotocol/sdk/experimental/tasks';
import type { TemporalConnectionManager } from '../../../temporal/src/connection.ts';
import type { AppConfigContract } from '../contracts/config.ts';
import { DEFAULT_APP_CONFIG } from '../config/schema.ts';
import { AuditLogger } from '../safety/audit-log.ts';
import { registerWorkflowTools } from './register-workflow.ts';

export interface RegisterTemporalToolsOptions {
	configuration?: AppConfigContract;
	auditLogger?: AuditLogger;
	taskStore?: InMemoryTaskStore;
}

export function registerTemporalTools(
	server: McpServer,
	connectionManager: TemporalConnectionManager,
	options?: RegisterTemporalToolsOptions,
): void {
	const { configuration = DEFAULT_APP_CONFIG, auditLogger = new AuditLogger(), taskStore } = options ?? {};

	registerWorkflowTools({
		server,
		connectionManager,
		config: configuration,
		auditLogger,
		taskStore,
	});
}
