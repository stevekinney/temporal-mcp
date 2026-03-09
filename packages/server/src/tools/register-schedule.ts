import { z } from 'zod/v4';
import type { ToolRegistrationContext } from './register-all.ts';
import { errorResponse, successResponse } from './response-helpers.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import { evaluatePolicy } from '../policy/evaluate.ts';
import { getToolContract } from '../../../temporal/src/capability-matrix.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';
import { resolveTemporalPolicyScope } from './policy-context.ts';

export function registerScheduleTools(context: ToolRegistrationContext): void {
	const { server, connectionManager, config, auditLogger } = context;

	server.registerTool(
		'temporal.schedule.list',
		{
			description: 'List schedules from a Temporal cluster.',
			inputSchema: {
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				pageSize: z
					.number()
					.min(1)
					.max(100)
					.default(10)
					.describe('Maximum number of schedules to return'),
			},
		},
		async ({ profile, pageSize }, extra) => {
			const requestContext = buildRequestContext(
				'temporal.schedule.list',
				{ profile, pageSize },
				extra,
			);
			auditLogger.logToolCall(requestContext, { profile, pageSize });
			const startTime = Date.now();

			try {
				const contract = getToolContract('temporal.schedule.list');
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

				const { listSchedules } = await import(
					'../../../temporal/src/tools/schedule/list.ts'
				);
				const client = await connectionManager.getClient(profile);
				const schedules = await listSchedules(client, { pageSize });
				const result = successResponse(redactSensitiveFields(schedules));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'temporal.schedule.describe',
		{
			description: 'Get detailed information about a specific schedule.',
			inputSchema: {
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				scheduleId: z.string().describe('The schedule ID to describe'),
			},
		},
		async ({ profile, scheduleId }, extra) => {
			const requestContext = buildRequestContext(
				'temporal.schedule.describe',
				{ profile, scheduleId },
				extra,
			);
			auditLogger.logToolCall(requestContext, { profile, scheduleId });
			const startTime = Date.now();

			try {
				const contract = getToolContract('temporal.schedule.describe');
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

				const { describeSchedule } = await import(
					'../../../temporal/src/tools/schedule/describe.ts'
				);
				const client = await connectionManager.getClient(profile);
				const description = await describeSchedule(client, { scheduleId });
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
		'temporal.schedule.matching-times',
		{
			description: 'Get the matching times for a schedule within a time range.',
			inputSchema: {
				profile: z
					.string()
					.optional()
					.describe('Temporal connection profile name'),
				scheduleId: z
					.string()
					.describe('The schedule ID to check matching times for'),
				startTime: z
					.string()
					.describe('Start of the time range (ISO 8601 format)'),
				endTime: z
					.string()
					.describe('End of the time range (ISO 8601 format)'),
			},
		},
		async (
			{ profile, scheduleId, startTime: rangeStart, endTime: rangeEnd },
			extra,
		) => {
			const requestContext = buildRequestContext(
				'temporal.schedule.matching-times',
				{ profile, scheduleId, startTime: rangeStart, endTime: rangeEnd },
				extra,
			);
			auditLogger.logToolCall(requestContext, {
				profile,
				scheduleId,
				startTime: rangeStart,
				endTime: rangeEnd,
			});
			const startTime = Date.now();

			try {
				const contract = getToolContract('temporal.schedule.matching-times');
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

				const { listScheduleMatchingTimes } = await import(
					'../../../temporal/src/tools/schedule/matching-times.ts'
				);
				const client = await connectionManager.getClient(profile);
				const matchingTimes = await listScheduleMatchingTimes(client, {
					namespace: policyScope.namespace,
					scheduleId,
					startTime: rangeStart,
					endTime: rangeEnd,
				});
				const result = successResponse(redactSensitiveFields(matchingTimes));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);
}
