import { z } from 'zod/v4';
import type { ToolRegistrationContext } from './register-all.ts';
import { errorResponse, successResponse } from './response-helpers.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import { evaluatePolicy } from '../policy/evaluate.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';
import { resolveTemporalPolicyScope } from './policy-context.ts';
import { requireToolContract } from './tool-contract.ts';
import { inputSchema } from './zod-compat.ts';

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
			const requestContext = buildRequestContext(
				'temporal.connection.check',
				{ profile },
				extra,
			);
			const startTime = Date.now();
			let hasLoggedToolCall = false;

			try {
				const policyScope = resolveTemporalPolicyScope(context, profile);
				requestContext.profile = policyScope.profile;
				auditLogger.logToolCall(requestContext, {
					profile: policyScope.profile,
				});
				hasLoggedToolCall = true;

				const contract = requireToolContract('temporal.connection.check');
				const decision = evaluatePolicy(config.policy, contract, policyScope);
				auditLogger.logPolicyDecision(requestContext, decision);
				if (!decision.allowed) {
					auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
					return errorResponse({
						ok: false,
						error: { code: decision.code, message: decision.reason, retryable: false },
					});
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
				if (!hasLoggedToolCall) {
					auditLogger.logToolCall(requestContext, { profile });
				}
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);
}
