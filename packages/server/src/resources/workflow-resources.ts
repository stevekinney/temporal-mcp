import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';
import {
	assertResourcePolicy,
	getVariable,
	jsonResourceContent,
	type ResourceTemplateVariables,
} from './resource-helpers.ts';

export function registerWorkflowResources(
	context: ResourceRegistrationContext,
): void {
	const { server, connectionManager } = context;

	server.registerResource(
		'temporal-workflow',
		new ResourceTemplate('temporal:///{profile}/workflow/{workflowId}', {
			list: undefined,
		}),
		{
			description: 'A Temporal workflow execution',
			mimeType: 'application/json',
		},
		async (uri: URL, variables: ResourceTemplateVariables) => {
			const profile = getVariable(variables, 'profile');
			const workflowId = getVariable(variables, 'workflowId');
			const effectiveProfile =
				connectionManager.resolveProfileName(profile || undefined);
			const profileConfiguration =
				connectionManager.getProfileConfiguration(effectiveProfile);
			assertResourcePolicy(context, 'temporal.workflow.describe', {
				profile: effectiveProfile,
				namespace: profileConfiguration.namespace,
			});

			const client = await connectionManager.getClient(effectiveProfile);
			const handle = client.workflow.getHandle(workflowId);
			const description = await handle.describe();
			return {
				contents: [
					jsonResourceContent(uri, description),
				],
			};
		},
	);
}
