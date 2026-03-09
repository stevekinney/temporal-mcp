import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { InMemoryTaskStore } from '@modelcontextprotocol/sdk/experimental/tasks';
import type { TemporalConnectionManager } from '../../../temporal/src/connection.ts';
import type { AppConfigContract } from '../contracts/config.ts';
import { AuditLogger } from '../safety/audit-log.ts';
import { registerWorkflowTools } from './register-workflow.ts';
import { registerScheduleTools } from './register-schedule.ts';
import { registerInfrastructureTools } from './register-infrastructure.ts';
import { registerWorkerTools } from './register-worker.ts';
import { registerConnectionTools } from './register-connection.ts';
import { registerDocsTools } from './register-docs.ts';

export interface ToolRegistrationContext {
	server: McpServer;
	connectionManager: TemporalConnectionManager;
	config: AppConfigContract;
	auditLogger: AuditLogger;
	taskStore?: InMemoryTaskStore;
}

export function registerAllTools(context: ToolRegistrationContext): void {
	registerWorkflowTools(context);
	registerScheduleTools(context);
	registerInfrastructureTools(context);
	registerWorkerTools(context);
	registerConnectionTools(context);
	registerDocsTools(context);
}
