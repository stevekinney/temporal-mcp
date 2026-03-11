import { z } from 'zod/v4';
import type { ToolRegistrationContext } from './register-all.ts';
import { errorResponse, successResponse } from './response-helpers.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import { evaluatePolicy } from '../policy/evaluate.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';
import { resolveTemporalPolicyScope } from './policy-context.ts';
import { requireToolContract } from './tool-contract.ts';
import { inputSchema } from './zod-compat.ts';

export function registerWorkerTools(context: ToolRegistrationContext): void {
	const { server, connectionManager, config, auditLogger } = context;

	server.registerTool(
		'temporal.worker.versioning-rules',
		{
			description:
				'Get the worker versioning rules for a task queue, including assignment and redirect rules.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				taskQueue: z
					.string()
					.describe('The task queue to get versioning rules for'),
			}),
		},
		async ({ profile, taskQueue }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.worker.versioning-rules',
				{ profile, taskQueue },
				extra,
			);
			const startTime = Date.now();
			let hasLoggedToolCall = false;

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext.profile = policyScope.profile;
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					taskQueue,
				});
				hasLoggedToolCall = true;

				const contract = requireToolContract('temporal.worker.versioning-rules');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { getVersioningRules } = await import(
					'../../../temporal/src/tools/worker/versioning-rules.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const rules = await getVersioningRules(client, {
					namespace: policyScope.namespace,
					taskQueue,
				});
				const result = successResponse(redactSensitiveFields(rules));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				if (!hasLoggedToolCall) {
					auditLogger.logToolCall(requestContext, { profile, taskQueue });
				}
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.worker.task-reachability',
		{
			description:
				'Check task reachability for a task queue to determine if workers can receive tasks.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				taskQueue: z
					.string()
					.describe('The task queue to check reachability for'),
				buildIds: z
					.array(z.string())
					.optional()
					.describe('Build IDs to check reachability for'),
			}),
		},
		async ({ profile, taskQueue, buildIds }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.worker.task-reachability',
				{ profile, taskQueue, buildIds },
				extra,
			);
			const startTime = Date.now();
			let hasLoggedToolCall = false;

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext.profile = policyScope.profile;
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					taskQueue,
					buildIds,
				});
				hasLoggedToolCall = true;

				const contract = requireToolContract('temporal.worker.task-reachability');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { getTaskReachability } = await import(
					'../../../temporal/src/tools/worker/task-reachability.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const reachability = await getTaskReachability(client, {
					namespace: policyScope.namespace,
					taskQueue,
					buildIds,
				});
				const result = successResponse(redactSensitiveFields(reachability));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				if (!hasLoggedToolCall) {
					auditLogger.logToolCall(requestContext, { profile, taskQueue, buildIds });
				}
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.worker.deployment.list',
		{
			description: 'List worker deployments in a namespace.',
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
					.describe('Maximum number of deployments to return'),
			}),
		},
		async ({ profile, pageSize }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.worker.deployment.list',
				{ profile, pageSize },
				extra,
			);
			const startTime = Date.now();
			let hasLoggedToolCall = false;

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext.profile = policyScope.profile;
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					pageSize,
				});
				hasLoggedToolCall = true;

				const contract = requireToolContract('temporal.worker.deployment.list');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { listWorkerDeployments } = await import(
					'../../../temporal/src/tools/worker/deployment.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const deployments = await listWorkerDeployments(client, {
					namespace: policyScope.namespace,
					pageSize,
				});
				const result = successResponse(redactSensitiveFields(deployments));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				if (!hasLoggedToolCall) {
					auditLogger.logToolCall(requestContext, { profile, pageSize });
				}
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.worker.deployment.describe',
		{
			description: 'Describe a specific worker deployment including its versions.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				deploymentName: z
					.string()
					.describe('The deployment name to describe'),
			}),
		},
		async ({ profile, deploymentName }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.worker.deployment.describe',
				{ profile, deploymentName },
				extra,
			);
			const startTime = Date.now();
			let hasLoggedToolCall = false;

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext.profile = policyScope.profile;
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					deploymentName,
				});
				hasLoggedToolCall = true;

				const contract = requireToolContract('temporal.worker.deployment.describe');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { describeWorkerDeployment } = await import(
					'../../../temporal/src/tools/worker/deployment.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const description = await describeWorkerDeployment(client, {
					namespace: policyScope.namespace,
					deploymentName,
				});
				const result = successResponse(redactSensitiveFields(description));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				if (!hasLoggedToolCall) {
					auditLogger.logToolCall(requestContext, { profile, deploymentName });
				}
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.worker.deployment.version.describe',
		{
			description: 'Describe a specific version of a worker deployment.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				deploymentName: z.string().describe('The deployment name'),
				buildId: z
					.string()
					.describe('The build ID of the version to describe'),
			}),
		},
		async ({ profile, deploymentName, buildId }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.worker.deployment.version.describe',
				{ profile, deploymentName, buildId },
				extra,
			);
			const startTime = Date.now();
			let hasLoggedToolCall = false;

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext.profile = policyScope.profile;
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					deploymentName,
					buildId,
				});
				hasLoggedToolCall = true;

				const contract = requireToolContract(
					'temporal.worker.deployment.version.describe',
				);
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { describeWorkerDeploymentVersion } = await import(
					'../../../temporal/src/tools/worker/deployment.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const description = await describeWorkerDeploymentVersion(client, {
					namespace: policyScope.namespace,
					deploymentName,
					buildId,
				});
				const result = successResponse(redactSensitiveFields(description));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				if (!hasLoggedToolCall) {
					auditLogger.logToolCall(requestContext, { profile, deploymentName, buildId });
				}
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.worker.deployment.reachability',
		{
			description:
				'Check reachability of a worker deployment to determine if it can still receive tasks.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				deploymentName: z
					.string()
					.describe('The deployment name to check reachability for'),
			}),
		},
		async ({ profile, deploymentName }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'temporal.worker.deployment.reachability',
				{ profile, deploymentName },
				extra,
			);
			const startTime = Date.now();
			let hasLoggedToolCall = false;

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext.profile = policyScope.profile;
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
					deploymentName,
				});
				hasLoggedToolCall = true;

				const contract = requireToolContract(
					'temporal.worker.deployment.reachability',
				);
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
				}

				const { getDeploymentReachability } = await import(
					'../../../temporal/src/tools/worker/deployment.ts'
				);
				const client = await connectionManager.getClient(policyScope.profile);
				const reachability = await getDeploymentReachability(client, {
					namespace: policyScope.namespace,
					deploymentName,
				});
				const result = successResponse(redactSensitiveFields(reachability));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				if (!hasLoggedToolCall) {
					auditLogger.logToolCall(requestContext, { profile, deploymentName });
				}
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);
}
