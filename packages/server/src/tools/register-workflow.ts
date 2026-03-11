import { z } from 'zod/v4';
import type { ToolRegistrationContext } from './register-all.ts';
import { errorResponse, successResponse } from './response-helpers.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import { evaluatePolicy } from '../policy/evaluate.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';
import { resolveTemporalPolicyScope } from './policy-context.ts';
import { requireToolContract } from './tool-contract.ts';
import { inputSchema } from './zod-compat.ts';

type WorkflowPolicyGateResult =
	| {
			policyScope: ReturnType<typeof resolveTemporalPolicyScope>;
			decision: ReturnType<typeof evaluatePolicy>;
			blocked: null;
	  }
	| {
			policyScope: ReturnType<typeof resolveTemporalPolicyScope> | null;
			decision: ReturnType<typeof evaluatePolicy> | null;
			blocked: ReturnType<typeof errorResponse>;
	  };

function policyGate(
	context: ToolRegistrationContext,
	toolName: string,
	profile: string | undefined,
	namespace?: string,
): WorkflowPolicyGateResult {
	const policyScope = resolveTemporalPolicyScope(context, profile, namespace);
	const contract = requireToolContract(toolName);
	const decision = evaluatePolicy(context.config.policy, contract, policyScope);
	if (!decision.allowed) {
		return {
			policyScope,
			decision,
			blocked: errorResponse({
				ok: false,
				error: {
					code: decision.code,
					message: decision.reason,
					retryable: false,
				},
			}),
		};
	}

	return {
		policyScope,
		decision,
		blocked: null,
	};
}

export function registerWorkflowTools(context: ToolRegistrationContext): void {
	const { server, connectionManager, auditLogger } = context;

	server.registerTool(
		'temporal.workflow.list',
		{
			description:
				'List workflows from a Temporal cluster. Supports visibility query filters.',
			inputSchema: inputSchema({
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
			}),
		},
		async ({ profile, query, pageSize }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.workflow.list',
				{ profile, query, pageSize },
				extra,
			);
			const startTime = Date.now();

			try {
				const gate = policyGate(context, 'temporal.workflow.list', profile);
				if (gate.policyScope) {
					requestContext.profile = gate.policyScope.profile;
				}
				auditLogger.logToolCall(requestContext, {
					profile: gate.policyScope?.profile ?? profile,
					query,
					pageSize,
				});
				if (gate.decision) {
					auditLogger.logPolicyDecision(requestContext, gate.decision);
				}
				if (gate.blocked) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return gate.blocked;
				}

				const { listWorkflows } = await import(
					'../../../temporal/src/tools/workflow/list.ts'
				);
				const client = await connectionManager.getClient(gate.policyScope.profile);
				const workflows = await listWorkflows(client, { query, pageSize });
				const result = successResponse(redactSensitiveFields(workflows));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.workflow.describe',
		{
			description:
				'Get detailed information about a specific workflow execution.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				workflowId: z.string().describe('The workflow ID to describe'),
				runId: z
					.string()
					.optional()
					.describe('Specific run ID (defaults to latest run)'),
			}),
		},
		async ({ profile, workflowId, runId }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.workflow.describe',
				{ profile, workflowId, runId },
				extra,
			);
			const startTime = Date.now();

			try {
				const gate = policyGate(context, 'temporal.workflow.describe', profile);
				if (gate.policyScope) {
					requestContext.profile = gate.policyScope.profile;
				}
				auditLogger.logToolCall(requestContext, {
					profile: gate.policyScope?.profile ?? profile,
					workflowId,
					runId,
				});
				if (gate.decision) {
					auditLogger.logPolicyDecision(requestContext, gate.decision);
				}
				if (gate.blocked) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return gate.blocked;
				}

				const { describeWorkflow } = await import(
					'../../../temporal/src/tools/workflow/describe.ts'
				);
				const client = await connectionManager.getClient(gate.policyScope.profile);
				const description = await describeWorkflow(client, { workflowId, runId });
				const result = successResponse(redactSensitiveFields(description));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.workflow.count',
		{
			description: 'Count workflows matching a visibility query filter.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				query: z
					.string()
					.optional()
					.describe('Visibility query filter'),
			}),
		},
		async ({ profile, query }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.workflow.count',
				{ profile, query },
				extra,
			);
			const startTime = Date.now();

			try {
				const gate = policyGate(context, 'temporal.workflow.count', profile);
				if (gate.policyScope) {
					requestContext.profile = gate.policyScope.profile;
				}
				auditLogger.logToolCall(requestContext, {
					profile: gate.policyScope?.profile ?? profile,
					query,
				});
				if (gate.decision) {
					auditLogger.logPolicyDecision(requestContext, gate.decision);
				}
				if (gate.blocked) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return gate.blocked;
				}

				const { countWorkflows } = await import(
					'../../../temporal/src/tools/workflow/count.ts'
				);
				const client = await connectionManager.getClient(gate.policyScope.profile);
				const countResult = await countWorkflows(client, { query });
				const result = successResponse(redactSensitiveFields(countResult));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.workflow.result',
		{
			description: 'Get the result of a completed workflow execution.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				workflowId: z
					.string()
					.describe('The workflow ID to get the result for'),
				runId: z
					.string()
					.optional()
					.describe('Specific run ID (defaults to latest run)'),
			}),
		},
		async ({ profile, workflowId, runId }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.workflow.result',
				{ profile, workflowId, runId },
				extra,
			);
			const startTime = Date.now();

			try {
				const gate = policyGate(context, 'temporal.workflow.result', profile);
				if (gate.policyScope) {
					requestContext.profile = gate.policyScope.profile;
				}
				auditLogger.logToolCall(requestContext, {
					profile: gate.policyScope?.profile ?? profile,
					workflowId,
					runId,
				});
				if (gate.decision) {
					auditLogger.logPolicyDecision(requestContext, gate.decision);
				}
				if (gate.blocked) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return gate.blocked;
				}

				const { getWorkflowResult } = await import(
					'../../../temporal/src/tools/workflow/result.ts'
				);
				const client = await connectionManager.getClient(gate.policyScope.profile);
				const workflowResult = await getWorkflowResult(client, { workflowId, runId });
				const result = successResponse(redactSensitiveFields(workflowResult));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.workflow.query',
		{
			description:
				'Query a running workflow execution using a named query handler.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				workflowId: z.string().describe('The workflow ID to query'),
				runId: z
					.string()
					.optional()
					.describe('Specific run ID (defaults to latest run)'),
				queryType: z.string().describe('The name of the query handler'),
				queryArgs: z
					.array(z.unknown())
					.optional()
					.describe('Arguments to pass to the query handler'),
			}),
		},
		async ({ profile, workflowId, runId, queryType, queryArgs }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.workflow.query',
				{ profile, workflowId, runId, queryType },
				extra,
			);
			const startTime = Date.now();

			try {
				const gate = policyGate(context, 'temporal.workflow.query', profile);
				if (gate.policyScope) {
					requestContext.profile = gate.policyScope.profile;
				}
				auditLogger.logToolCall(requestContext, {
					profile: gate.policyScope?.profile ?? profile,
					workflowId,
					runId,
					queryType,
				});
				if (gate.decision) {
					auditLogger.logPolicyDecision(requestContext, gate.decision);
				}
				if (gate.blocked) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return gate.blocked;
				}

				const { queryWorkflow } = await import(
					'../../../temporal/src/tools/workflow/query.ts'
				);
				const client = await connectionManager.getClient(gate.policyScope.profile);
				const queryResult = await queryWorkflow(client, {
					workflowId,
					runId,
					queryName: queryType,
					args: queryArgs,
				});
				const result = successResponse(redactSensitiveFields(queryResult));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.workflow.history',
		{
			description:
				'Get the event history of a workflow execution in chronological order.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				workflowId: z
					.string()
					.describe('The workflow ID to get history for'),
				runId: z
					.string()
					.optional()
					.describe('Specific run ID (defaults to latest run)'),
			}),
		},
		async ({ profile, workflowId, runId }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.workflow.history',
				{ profile, workflowId, runId },
				extra,
			);
			const startTime = Date.now();

			try {
				const gate = policyGate(context, 'temporal.workflow.history', profile);
				if (gate.policyScope) {
					requestContext.profile = gate.policyScope.profile;
				}
				auditLogger.logToolCall(requestContext, {
					profile: gate.policyScope?.profile ?? profile,
					workflowId,
					runId,
				});
				if (gate.decision) {
					auditLogger.logPolicyDecision(requestContext, gate.decision);
				}
				if (gate.blocked) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return gate.blocked;
				}

				const { getWorkflowHistory } = await import(
					'../../../temporal/src/tools/workflow/history.ts'
				);
				const client = await connectionManager.getClient(gate.policyScope.profile);
				const history = await getWorkflowHistory(client, { workflowId, runId });
				const result = successResponse(redactSensitiveFields(history));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.workflow.history.reverse',
		{
			description:
				'Get the event history of a workflow execution in reverse chronological order via gRPC.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				workflowId: z
					.string()
					.describe('The workflow ID to get history for'),
				runId: z.string().describe('The run ID of the workflow execution'),
				pageSize: z
					.number()
					.min(1)
					.max(1000)
					.default(100)
					.describe('Maximum number of events to return'),
			}),
		},
		async ({ profile, workflowId, runId, pageSize }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.workflow.history.reverse',
				{ profile, workflowId, runId, pageSize },
				extra,
			);
			const startTime = Date.now();

			try {
				const gate = policyGate(context, 'temporal.workflow.history.reverse', profile);
				if (gate.policyScope) {
					requestContext.profile = gate.policyScope.profile;
				}
				auditLogger.logToolCall(requestContext, {
					profile: gate.policyScope?.profile ?? profile,
					workflowId,
					runId,
					pageSize,
				});
				if (gate.decision) {
					auditLogger.logPolicyDecision(requestContext, gate.decision);
				}
				if (gate.blocked) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return gate.blocked;
				}

				const { getWorkflowHistoryReverse } = await import(
					'../../../temporal/src/tools/workflow/history.ts'
				);
				const client = await connectionManager.getClient(gate.policyScope.profile);
				const history = await getWorkflowHistoryReverse(client, {
					namespace: gate.policyScope.namespace,
					workflowId,
					runId,
					pageSize,
				});
				const result = successResponse(redactSensitiveFields(history));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.workflow.history.summarize',
		{
			description:
				'Get a summarized view of workflow execution history, focusing on key events.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				workflowId: z
					.string()
					.describe('The workflow ID to summarize history for'),
				runId: z
					.string()
					.optional()
					.describe('Specific run ID (defaults to latest run)'),
			}),
		},
		async ({ profile, workflowId, runId }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.workflow.history.summarize',
				{ profile, workflowId, runId },
				extra,
			);
			const startTime = Date.now();

			try {
				const gate = policyGate(context, 'temporal.workflow.history.summarize', profile);
				if (gate.policyScope) {
					requestContext.profile = gate.policyScope.profile;
				}
				auditLogger.logToolCall(requestContext, {
					profile: gate.policyScope?.profile ?? profile,
					workflowId,
					runId,
				});
				if (gate.decision) {
					auditLogger.logPolicyDecision(requestContext, gate.decision);
				}
				if (gate.blocked) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return gate.blocked;
				}

				const { getWorkflowHistory, summarizeWorkflowHistory } =
					await import(
						'../../../temporal/src/tools/workflow/history.ts'
					);
				const client = await connectionManager.getClient(gate.policyScope.profile);
				const history = (await getWorkflowHistory(client, {
					workflowId,
					runId,
				})) as {
					events: Array<{
						eventId: string;
						eventType: string;
						eventTime: string | null;
					}>;
				};
				const summary = summarizeWorkflowHistory(history.events);
				const result = successResponse(redactSensitiveFields(summary));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);
}
