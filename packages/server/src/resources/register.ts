import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TemporalConnectionManager } from '../../../temporal/src/connection.ts';
import type { AppConfigContract } from '../contracts/config.ts';
import type { AuditLogger } from '../safety/audit-log.ts';
import { registerWorkflowResources } from './workflow-resources.ts';
import { registerScheduleResources } from './schedule-resources.ts';
import { registerTaskQueueResources } from './task-queue-resources.ts';
import { registerNamespaceResources } from './namespace-resources.ts';
import { registerDocsResources } from './docs-resources.ts';

export interface ResourceRegistrationContext {
	server: McpServer;
	connectionManager: TemporalConnectionManager;
	config: AppConfigContract;
	auditLogger: AuditLogger;
}

export function registerAllResources(
	context: ResourceRegistrationContext,
): void {
	registerWorkflowResources(context);
	registerScheduleResources(context);
	registerTaskQueueResources(context);
	registerNamespaceResources(context);
	registerDocsResources(context);
}
