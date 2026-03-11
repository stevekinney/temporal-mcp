import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';
import { describeTaskQueue } from '../../../temporal/src/grpc.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import {
	assertResourcePolicy,
	getVariable,
	jsonResourceContent,
	logToolCallOnce,
	type ResourceTemplateVariables,
} from './resource-helpers.ts';

export function registerTaskQueueResources(
	context: ResourceRegistrationContext,
): void {
	const { server, connectionManager, auditLogger } = context;

	server.registerResource(
		'temporal-task-queue',
		new ResourceTemplate('temporal:///{profile}/task-queue/{taskQueue}', {
			list: undefined,
		}),
		{
			description: 'A Temporal task queue',
			mimeType: 'application/json',
		},
		async (uri: URL, variables: ResourceTemplateVariables) => {
			const profile = getVariable(variables, 'profile');
			const taskQueue = getVariable(variables, 'taskQueue');
			const requestContext = buildRequestContext(
				'resource.temporal-task-queue',
				{ profile: profile || undefined },
			);
			const startTime = Date.now();
			const loggingState = { hasLoggedToolCall: false };

			try {
				const effectiveProfile =
					connectionManager.resolveProfileName(profile || undefined);
				requestContext.profile = effectiveProfile;
				logToolCallOnce(
					context,
					requestContext,
					{ profile: effectiveProfile, taskQueue },
					loggingState,
				);
				const profileConfiguration =
					connectionManager.getProfileConfiguration(effectiveProfile);

				assertResourcePolicy(
					context,
					'temporal.task-queue.describe',
					{
						profile: effectiveProfile,
						namespace: profileConfiguration.namespace,
					},
					requestContext,
				);

				const client = await connectionManager.getClient(effectiveProfile);
				const result = await describeTaskQueue(client, {
					namespace: profileConfiguration.namespace,
					taskQueue,
				});
				const resourceResult = {
					contents: [jsonResourceContent(uri, result)],
				};
				auditLogger.logToolResult(
					requestContext,
					'success',
					Date.now() - startTime,
				);
				return resourceResult;
			} catch (error) {
				logToolCallOnce(
					context,
					requestContext,
					{ profile: profile || undefined, taskQueue },
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
