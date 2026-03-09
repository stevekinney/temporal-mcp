import { z } from 'zod/v4';
import type { ToolRegistrationContext } from './register-all.ts';
import { errorResponse, successResponse } from './response-helpers.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import { evaluatePolicy } from '../policy/evaluate.ts';
import { getToolContract } from '../../../temporal/src/capability-matrix.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';
import { resolveTemporalPolicyScope } from './policy-context.ts';

export function registerWorkerTools(context: ToolRegistrationContext): void {
	const { server, connectionManager, config, auditLogger } = context;

	server.registerTool(
		'temporal.worker.versioning-rules',
		{
			description:
				'Get the worker versioning rules for a task queue, including assignment and redirect rules.',
			inputSchema: {
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				taskQueue: z
					.string()
					.describe('The task queue to get versioning rules for'),
			},
		},
		async ({ profile, taskQueue }, extra) => {
			const requestContext = buildRequestContext(
				'temporal.worker.versioning-rules',
				{ profile, taskQueue },
				extra,
			);
			auditLogger.logToolCall(requestContext, { profile, taskQueue });
			const startTime = Date.now();

			try {
				const contract = getToolContract('temporal.worker.versioning-rules');
				const policyScope = resolveTemporalPolicyScope(context, profile);
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, policyScope);
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const { getVersioningRules } = await import(
					'../../../temporal/src/tools/worker/versioning-rules.ts'
				);
				const client = await connectionManager.getClient(profile);
				const rules = await getVersioningRules(client, {
					namespace: policyScope.namespace,
					taskQueue,
				});
				const result = successResponse(redactSensitiveFields(rules));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
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
			inputSchema: {
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
			},
		},
		async ({ profile, taskQueue, buildIds }, extra) => {
			const requestContext = buildRequestContext(
				'temporal.worker.task-reachability',
				{ profile, taskQueue, buildIds },
				extra,
			);
			auditLogger.logToolCall(requestContext, { profile, taskQueue, buildIds });
			const startTime = Date.now();

			try {
				const contract = getToolContract('temporal.worker.task-reachability');
				const policyScope = resolveTemporalPolicyScope(context, profile);
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, policyScope);
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const { getTaskReachability } = await import(
					'../../../temporal/src/tools/worker/task-reachability.ts'
				);
				const client = await connectionManager.getClient(profile);
				const reachability = await getTaskReachability(client, {
					taskQueue,
					buildIds,
				});
				const result = successResponse(redactSensitiveFields(reachability));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.worker.deployment.list',
		{
			description: 'List worker deployments in a namespace.',
			inputSchema: {
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
			},
		},
		async ({ profile, pageSize }, extra) => {
			const requestContext = buildRequestContext(
				'temporal.worker.deployment.list',
				{ profile, pageSize },
				extra,
			);
			auditLogger.logToolCall(requestContext, { profile, pageSize });
			const startTime = Date.now();

			try {
				const contract = getToolContract('temporal.worker.deployment.list');
				const policyScope = resolveTemporalPolicyScope(context, profile);
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, policyScope);
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const { listWorkerDeployments } = await import(
					'../../../temporal/src/tools/worker/deployment.ts'
				);
				const client = await connectionManager.getClient(profile);
				const deployments = await listWorkerDeployments(client, {
					namespace: policyScope.namespace,
					pageSize,
				});
				const result = successResponse(redactSensitiveFields(deployments));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.worker.deployment.describe',
		{
			description: 'Describe a specific worker deployment including its versions.',
			inputSchema: {
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				deploymentName: z
					.string()
					.describe('The deployment name to describe'),
			},
		},
		async ({ profile, deploymentName }, extra) => {
			const requestContext = buildRequestContext(
				'temporal.worker.deployment.describe',
				{ profile, deploymentName },
				extra,
			);
			auditLogger.logToolCall(requestContext, { profile, deploymentName });
			const startTime = Date.now();

			try {
				const contract = getToolContract('temporal.worker.deployment.describe');
				const policyScope = resolveTemporalPolicyScope(context, profile);
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, policyScope);
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const { describeWorkerDeployment } = await import(
					'../../../temporal/src/tools/worker/deployment.ts'
				);
				const client = await connectionManager.getClient(profile);
				const description = await describeWorkerDeployment(client, {
					namespace: policyScope.namespace,
					deploymentName,
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
		'temporal.worker.deployment.version.describe',
		{
			description: 'Describe a specific version of a worker deployment.',
			inputSchema: {
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				deploymentName: z.string().describe('The deployment name'),
				buildId: z
					.string()
					.describe('The build ID of the version to describe'),
			},
		},
		async ({ profile, deploymentName, buildId }, extra) => {
			const requestContext = buildRequestContext(
				'temporal.worker.deployment.version.describe',
				{ profile, deploymentName, buildId },
				extra,
			);
			auditLogger.logToolCall(requestContext, { profile, deploymentName, buildId });
			const startTime = Date.now();

			try {
				const contract = getToolContract('temporal.worker.deployment.version.describe');
				const policyScope = resolveTemporalPolicyScope(context, profile);
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, policyScope);
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const { describeWorkerDeploymentVersion } = await import(
					'../../../temporal/src/tools/worker/deployment.ts'
				);
				const client = await connectionManager.getClient(profile);
				const description = await describeWorkerDeploymentVersion(client, {
					namespace: policyScope.namespace,
					deploymentName,
					buildId,
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
		'temporal.worker.deployment.reachability',
		{
			description:
				'Check reachability of a worker deployment to determine if it can still receive tasks.',
			inputSchema: {
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				deploymentName: z
					.string()
					.describe('The deployment name to check reachability for'),
			},
		},
		async ({ profile, deploymentName }, extra) => {
			const requestContext = buildRequestContext(
				'temporal.worker.deployment.reachability',
				{ profile, deploymentName },
				extra,
			);
			auditLogger.logToolCall(requestContext, { profile, deploymentName });
			const startTime = Date.now();

			try {
				const contract = getToolContract('temporal.worker.deployment.reachability');
				const policyScope = resolveTemporalPolicyScope(context, profile);
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, policyScope);
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const { getDeploymentReachability } = await import(
					'../../../temporal/src/tools/worker/deployment.ts'
				);
				const client = await connectionManager.getClient(profile);
				const reachability = await getDeploymentReachability(client, {
					namespace: policyScope.namespace,
					deploymentName,
				});
				const result = successResponse(redactSensitiveFields(reachability));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);
}
