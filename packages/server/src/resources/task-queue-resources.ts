import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';

type Variables = Record<string, string | string[]>;
import { describeTaskQueue } from '../../../temporal/src/grpc.ts';

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
		async (uri: URL, variables: Variables) => {
			const profile = String(variables.profile ?? '');
			const taskQueue = String(variables.taskQueue ?? '');
			const client = await connectionManager.getClient(profile);
			const profileConfig =
				connectionManager.getProfileConfiguration(profile);
			const result = await describeTaskQueue(client, {
				namespace: profileConfig.namespace,
				taskQueue,
			});
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'application/json',
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);
}
