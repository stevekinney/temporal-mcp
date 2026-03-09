import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';
import {
	assertResourcePolicy,
	getVariable,
	jsonResourceContent,
	type ResourceTemplateVariables,
} from './resource-helpers.ts';

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
		async (uri: URL, variables: ResourceTemplateVariables) => {
			const profile = getVariable(variables, 'profile');
			const scheduleId = getVariable(variables, 'scheduleId');
			const effectiveProfile =
				connectionManager.resolveProfileName(profile || undefined);
			const profileConfiguration =
				connectionManager.getProfileConfiguration(effectiveProfile);
			assertResourcePolicy(context, 'temporal.schedule.describe', {
				profile: effectiveProfile,
				namespace: profileConfiguration.namespace,
			});

			const client = await connectionManager.getClient(effectiveProfile);
			const handle = client.schedule.getHandle(scheduleId);
			const description = await handle.describe();
			return {
				contents: [
					jsonResourceContent(uri, description),
				],
			};
		},
	);
}
