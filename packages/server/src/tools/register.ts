import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import type { TemporalConnectionManager } from '../../../temporal/src/connection.ts';
import { listWorkflows } from '../../../temporal/src/tools/workflow-list.ts';
import { describeWorkflow } from '../../../temporal/src/tools/workflow-describe.ts';
import type { ErrorEnvelope } from '../contracts/error-envelope.ts';

function errorResponse(error: unknown) {
	let envelope: ErrorEnvelope;

	if (isErrorEnvelope(error)) {
		envelope = error;
	} else {
		const message =
			error instanceof Error ? error.message : 'An unknown error occurred';
		envelope = {
			ok: false,
			error: { code: 'INTERNAL_ERROR', message, retryable: false },
		};
	}

	return {
		content: [{ type: 'text' as const, text: JSON.stringify(envelope) }],
		isError: true,
	};
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
	return (
		typeof value === 'object' &&
		value !== null &&
		'ok' in value &&
		(value as ErrorEnvelope).ok === false &&
		'error' in value
	);
}

export function registerTemporalTools(
	server: McpServer,
	connectionManager: TemporalConnectionManager,
) {
	server.registerTool(
		'temporal.workflow.list',
		{
			description:
				'List workflows from a Temporal cluster. Supports visibility query filters.',
			inputSchema: {
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				query: z
					.string()
					.optional()
					.describe(
						"Visibility query filter (e.g. WorkflowType='MyWorkflow')",
					),
				pageSize: z
					.number()
					.min(1)
					.max(100)
					.default(10)
					.describe('Maximum number of workflows to return'),
			},
		},
		async ({ profile, query, pageSize }) => {
			try {
				const client = await connectionManager.getClient(profile);
				const workflows = await listWorkflows(client, { query, pageSize });

				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify(
								{ ok: true, data: workflows },
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.workflow.describe',
		{
			description:
				'Get detailed information about a specific workflow execution.',
			inputSchema: {
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				workflowId: z.string().describe('The workflow ID to describe'),
				runId: z
					.string()
					.optional()
					.describe('Specific run ID (defaults to latest run)'),
			},
		},
		async ({ profile, workflowId, runId }) => {
			try {
				const client = await connectionManager.getClient(profile);
				const description = await describeWorkflow(client, {
					workflowId,
					runId,
				});

				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify(
								{ ok: true, data: description },
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				return errorResponse(error);
			}
		},
	);
}
