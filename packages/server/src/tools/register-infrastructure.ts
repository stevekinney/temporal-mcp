import { z } from 'zod/v4';
import type { ToolRegistrationContext } from './register-all.ts';
import { errorResponse, successResponse } from './response-helpers.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import { evaluatePolicy } from '../policy/evaluate.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';
import { resolveTemporalPolicyScope } from './policy-context.ts';
import { requireToolContract } from './tool-contract.ts';
import { inputSchema } from './zod-compat.ts';

export function registerInfrastructureTools(
	context: ToolRegistrationContext,
): void {
	const { server, connectionManager, config, auditLogger } = context;

	server.registerTool(
		'temporal.task-queue.describe',
		{
			description:
				'Describe a task queue including poller information and backlog status.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				taskQueue: z
					.string()
					.describe('The name of the task queue to describe'),
			}),
		},
		async ({ profile, taskQueue }: any, extra: any) => {
			let requestContext = buildRequestContext(
				'temporal.task-queue.describe',
				{ profile, taskQueue },
				extra,
			);
			const startTime = Date.now();

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext = buildRequestContext(
					'temporal.task-queue.describe',
					{ profile: policyScope.profile, taskQueue },
					extra,
				);
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					taskQueue,
				});

				const contract = requireToolContract('temporal.task-queue.describe');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { describeTaskQueueTool } = await import(
					'../../../temporal/src/tools/infrastructure/task-queue-describe.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const description = await describeTaskQueueTool(client, {
					namespace: policyScope.namespace,
					taskQueue,
				});
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
		'temporal.task-queue.configuration',
		{
			description:
				'Get the configuration of a task queue including rate limits and poller settings.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				taskQueue: z
					.string()
					.describe('The name of the task queue to get configuration for'),
			}),
		},
		async ({ profile, taskQueue }: any, extra: any) => {
			let requestContext = buildRequestContext(
				'temporal.task-queue.configuration',
				{ profile, taskQueue },
				extra,
			);
			const startTime = Date.now();

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext = buildRequestContext(
					'temporal.task-queue.configuration',
					{ profile: policyScope.profile, taskQueue },
					extra,
				);
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					taskQueue,
				});

				const contract = requireToolContract('temporal.task-queue.configuration');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { getTaskQueueConfigurationTool } = await import(
					'../../../temporal/src/tools/infrastructure/task-queue-configuration.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const configuration = await getTaskQueueConfigurationTool(client, {
					namespace: policyScope.namespace,
					taskQueue,
				});
				const result = successResponse(redactSensitiveFields(configuration));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.namespace.list',
		{
			description: 'List all namespaces in a self-hosted Temporal cluster.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				pageSize: z
					.number()
					.min(1)
					.max(100)
					.default(100)
					.describe('Maximum number of namespaces to return'),
			}),
		},
		async ({ profile, pageSize }: any, extra: any) => {
			let requestContext = buildRequestContext(
				'temporal.namespace.list',
				{ profile, pageSize },
				extra,
			);
			const startTime = Date.now();

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext = buildRequestContext(
					'temporal.namespace.list',
					{ profile: policyScope.profile, pageSize },
					extra,
				);
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					pageSize,
				});

				const contract = requireToolContract('temporal.namespace.list');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { listNamespacesTool } = await import(
					'../../../temporal/src/tools/infrastructure/namespace-list.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const namespaces = await listNamespacesTool(client, { pageSize });
				const result = successResponse(redactSensitiveFields(namespaces));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.namespace.describe',
		{
			description: 'Get detailed information about a specific namespace.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				namespace: z.string().describe('The namespace name to describe'),
			}),
		},
		async ({ profile, namespace }: any, extra: any) => {
			let requestContext = buildRequestContext(
				'temporal.namespace.describe',
				{ profile, namespace },
				extra,
			);
			const startTime = Date.now();

			try {
				const policyScope = resolveTemporalPolicyScope(
					context,
					profile,
					namespace,
				);
				requestContext = buildRequestContext(
					'temporal.namespace.describe',
					{ profile: policyScope.profile, namespace },
					extra,
				);
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					namespace,
				});

				const contract = requireToolContract('temporal.namespace.describe');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { describeNamespaceTool } = await import(
					'../../../temporal/src/tools/infrastructure/namespace-describe.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const description = await describeNamespaceTool(client, { namespace });
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
		'temporal.search-attributes.list',
		{
			description: 'List search attributes configured for a namespace.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				namespace: z
					.string()
					.optional()
					.describe(
						'The namespace to list search attributes for (defaults to profile namespace)',
					),
			}),
		},
		async ({ profile, namespace }: any, extra: any) => {
			let requestContext = buildRequestContext(
				'temporal.search-attributes.list',
				{ profile, namespace },
				extra,
			);
			const startTime = Date.now();

			try {
				const policyScope = resolveTemporalPolicyScope(
					context,
					profile,
					namespace,
				);
				requestContext = buildRequestContext(
					'temporal.search-attributes.list',
					{ profile: policyScope.profile, namespace: policyScope.namespace },
					extra,
				);
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					namespace: policyScope.namespace,
				});

				const contract = requireToolContract('temporal.search-attributes.list');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { listSearchAttributesTool } = await import(
					'../../../temporal/src/tools/infrastructure/search-attributes-list.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const attributes = await listSearchAttributesTool(client, {
					namespace: policyScope.namespace,
				});
				const result = successResponse(redactSensitiveFields(attributes));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.cluster.info',
		{
			description:
				'Get system information about the Temporal cluster including server version and capabilities.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
			}),
		},
		async ({ profile }: any, extra: any) => {
			let requestContext = buildRequestContext(
				'temporal.cluster.info',
				{ profile },
				extra,
			);
			const startTime = Date.now();

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext = buildRequestContext(
					'temporal.cluster.info',
					{ profile: policyScope.profile },
					extra,
				);
				auditLogger.logToolCall(requestContext, { profile: policyScope.profile });

				const contract = requireToolContract('temporal.cluster.info');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { getClusterInfo } = await import(
					'../../../temporal/src/tools/infrastructure/cluster-info.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const info = await getClusterInfo(client);
				const result = successResponse(redactSensitiveFields(info));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);
}
