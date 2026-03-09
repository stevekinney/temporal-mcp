import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';

type Variables = Record<string, string | string[]>;

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
		async (uri: URL, variables: Variables) => {
			const profile = String(variables.profile ?? '');
			const workflowId = String(variables.workflowId ?? '');
			const client = await connectionManager.getClient(profile);
			const handle = client.workflow.getHandle(workflowId);
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
