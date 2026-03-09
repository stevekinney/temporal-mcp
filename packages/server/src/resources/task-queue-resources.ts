import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';
import { describeTaskQueue } from '../../../temporal/src/grpc.ts';
import {
	assertResourcePolicy,
	getVariable,
	jsonResourceContent,
	type ResourceTemplateVariables,
} from './resource-helpers.ts';

export function registerTaskQueueResources(
	context: ResourceRegistrationContext,
): void {
	const { server, connectionManager } = context;

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
			assertResourcePolicy(context, 'temporal.task-queue.describe', {
				profile: effectiveProfile,
				namespace: profileConfiguration.namespace,
			});

			const client = await connectionManager.getClient(effectiveProfile);
			const profileConfig =
				connectionManager.getProfileConfiguration(effectiveProfile);
			const result = await describeTaskQueue(client, {
				namespace: profileConfig.namespace,
				taskQueue,
			});
			return {
				contents: [
					jsonResourceContent(uri, result),
				],
			};
		},
	);
}
