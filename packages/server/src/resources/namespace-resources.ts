import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';
import { describeNamespace } from '../../../temporal/src/grpc.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import {
	assertResourcePolicy,
	getVariable,
	jsonResourceContent,
	type ResourceTemplateVariables,
} from './resource-helpers.ts';

export function registerNamespaceResources(
	context: ResourceRegistrationContext,
): void {
	const { server, connectionManager, auditLogger } = context;

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
			const requestContext = buildRequestContext(
				'resource.temporal-namespace',
				{
					profile: effectiveProfile,
					namespace,
				},
			);
			auditLogger.logToolCall(requestContext, {
				profile: effectiveProfile,
				namespace,
			});
			const startTime = Date.now();

			try {
				assertResourcePolicy(
					context,
					'temporal.namespace.describe',
					{
						profile: effectiveProfile,
						namespace,
					},
					requestContext,
				);

				const client = await connectionManager.getClient(effectiveProfile);
				const result = await describeNamespace(client, { namespace });
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
