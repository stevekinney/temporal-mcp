import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';
import { describeNamespace } from '../../../temporal/src/grpc.ts';
import {
	assertResourcePolicy,
	getVariable,
	jsonResourceContent,
	type ResourceTemplateVariables,
} from './resource-helpers.ts';

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
		async (uri: URL, variables: ResourceTemplateVariables) => {
			const profile = getVariable(variables, 'profile');
			const namespace = getVariable(variables, 'namespace');
			const effectiveProfile =
				connectionManager.resolveProfileName(profile || undefined);
			assertResourcePolicy(context, 'temporal.namespace.describe', {
				profile: effectiveProfile,
				namespace,
			});

			const client = await connectionManager.getClient(effectiveProfile);
			const result = await describeNamespace(client, { namespace });
			return {
				contents: [
					jsonResourceContent(uri, result),
				],
			};
		},
	);
}
