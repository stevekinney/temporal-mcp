import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';

type Variables = Record<string, string | string[]>;
import { describeNamespace } from '../../../temporal/src/grpc.ts';

export function registerNamespaceResources(
	context: ResourceRegistrationContext,
): void {
	const { server, connectionManager } = context;

	server.registerResource(
		'temporal-namespace',
		new ResourceTemplate('temporal:///{profile}/namespace/{namespace}', {
			list: undefined,
		}),
		{
			description: 'A Temporal namespace',
			mimeType: 'application/json',
		},
		async (uri: URL, variables: Variables) => {
			const profile = String(variables.profile ?? '');
			const namespace = String(variables.namespace ?? '');
			const client = await connectionManager.getClient(profile);
			const result = await describeNamespace(client, { namespace });
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
