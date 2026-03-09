import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';
import { describeTaskQueue } from '../../../temporal/src/grpc.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import {
	assertResourcePolicy,
	getVariable,
	jsonResourceContent,
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
			const effectiveProfile =
				connectionManager.resolveProfileName(profile || undefined);
			const profileConfiguration =
				connectionManager.getProfileConfiguration(effectiveProfile);
			const requestContext = buildRequestContext(
				'resource.temporal-task-queue',
				{ profile: effectiveProfile },
			);
			auditLogger.logToolCall(requestContext, { profile: effectiveProfile, taskQueue });
			const startTime = Date.now();

			try {
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
