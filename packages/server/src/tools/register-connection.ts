import { z } from 'zod/v4';
import type { ToolRegistrationContext } from './register-all.ts';
import { errorResponse, successResponse } from './response-helpers.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import { evaluatePolicy } from '../policy/evaluate.ts';
import { getToolContract } from '../../../temporal/src/capability-matrix.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';
import { resolveTemporalPolicyScope } from './policy-context.ts';
import { inputSchema } from './zod-compat.ts';

function requireToolContract(toolName: string) {
	const contract = getToolContract(toolName);
	if (!contract) {
		throw {
			ok: false,
			error: {
				code: 'TOOL_NOT_FOUND',
				message: `Tool "${toolName}" is not registered in the capability matrix`,
				retryable: false,
			},
		};
	}
	return contract;
}

export function registerConnectionTools(
	context: ToolRegistrationContext,
): void {
	const { server, connectionManager, config, auditLogger } = context;

	server.registerTool(
		'temporal.connection.check',
		{
			description:
				'Check connectivity to a Temporal cluster by fetching system info.',
			inputSchema: inputSchema({
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
			}),
		},
		async ({ profile }: any, extra: any) => {
			let requestContext = buildRequestContext(
				'temporal.connection.check',
				{ profile },
				extra,
			);
			const startTime = Date.now();

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext = buildRequestContext(
					'temporal.connection.check',
					{ profile: policyScope.profile },
					extra,
				);
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
				});

				const contract = requireToolContract('temporal.connection.check');
				{
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

				const { checkConnection } = await import(
					'../../../temporal/src/tools/connection-check.ts'
				);
				const connectionResult = await checkConnection(
					connectionManager,
					policyScope.profile,
				);
				const result = successResponse(redactSensitiveFields(connectionResult));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);
}
