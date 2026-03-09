import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';

type Variables = Record<string, string | string[]>;

export function registerScheduleResources(
	context: ResourceRegistrationContext,
): void {
	const { server, connectionManager } = context;

	server.registerResource(
		'temporal-schedule',
		new ResourceTemplate('temporal:///{profile}/schedule/{scheduleId}', {
			list: undefined,
		}),
		{
			description: 'A Temporal schedule',
			mimeType: 'application/json',
		},
		async (uri: URL, variables: Variables) => {
			const profile = String(variables.profile ?? '');
			const scheduleId = String(variables.scheduleId ?? '');
			const client = await connectionManager.getClient(profile);
			const handle = client.schedule.getHandle(scheduleId);
			const description = await handle.describe();
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'application/json',
						text: JSON.stringify(description, null, 2),
					},
				],
			};
		},
	);
}
