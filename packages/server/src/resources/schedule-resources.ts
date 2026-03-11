import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import {
	assertResourcePolicy,
	getVariable,
	jsonResourceContent,
	logToolCallOnce,
	type ResourceTemplateVariables,
} from './resource-helpers.ts';

export function registerScheduleResources(
	context: ResourceRegistrationContext,
): void {
	const { server, connectionManager, auditLogger } = context;

	server.registerResource(
		'temporal-schedule',
		new ResourceTemplate('temporal:///{profile}/schedule/{scheduleId}', {
			list: undefined,
		}),
		{
			description: 'A Temporal schedule',
			mimeType: 'application/json',
		},
		async (uri: URL, variables: ResourceTemplateVariables) => {
			const profile = getVariable(variables, 'profile');
			const scheduleId = getVariable(variables, 'scheduleId');
			const requestContext = buildRequestContext('resource.temporal-schedule', {
				profile: profile || undefined,
			});
			const startTime = Date.now();
			const loggingState = { hasLoggedToolCall: false };

			try {
				const effectiveProfile =
					connectionManager.resolveProfileName(profile || undefined);
				requestContext.profile = effectiveProfile;
				logToolCallOnce(
					context,
					requestContext,
					{ profile: effectiveProfile, scheduleId },
					loggingState,
				);
				const profileConfiguration =
					connectionManager.getProfileConfiguration(effectiveProfile);

				assertResourcePolicy(
					context,
					'temporal.schedule.describe',
					{
						profile: effectiveProfile,
						namespace: profileConfiguration.namespace,
					},
					requestContext,
				);

				const client = await connectionManager.getClient(effectiveProfile);
				const handle = client.schedule.getHandle(scheduleId);
				const description = await handle.describe();
				const result = {
					contents: [jsonResourceContent(uri, description)],
				};
				auditLogger.logToolResult(
					requestContext,
					'success',
					Date.now() - startTime,
				);
				return result;
			} catch (error) {
				logToolCallOnce(
					context,
					requestContext,
					{ profile: profile || undefined, scheduleId },
					loggingState,
				);
				auditLogger.logToolResult(
					requestContext,
					'error',
					Date.now() - startTime,
				);
				throw error;
			}
		},
	);
}
