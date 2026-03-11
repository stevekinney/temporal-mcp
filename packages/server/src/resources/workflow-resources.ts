import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import {
	assertResourcePolicy,
	getVariable,
	jsonResourceContent,
	logToolCallOnce,
	type ResourceTemplateVariables,
} from './resource-helpers.ts';

export function registerWorkflowResources(
	context: ResourceRegistrationContext,
): void {
	const { server, connectionManager, auditLogger } = context;

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
			const requestContext = buildRequestContext('resource.temporal-workflow', {
				profile: profile || undefined,
			});
			const startTime = Date.now();
			const loggingState = { hasLoggedToolCall: false };

			try {
				const effectiveProfile =
					connectionManager.resolveProfileName(profile || undefined);
				requestContext.profile = effectiveProfile;
				logToolCallOnce(
					context,
					requestContext,
					{ profile: effectiveProfile, workflowId },
					loggingState,
				);
				const profileConfiguration =
					connectionManager.getProfileConfiguration(effectiveProfile);

				assertResourcePolicy(
					context,
					'temporal.workflow.describe',
					{
						profile: effectiveProfile,
						namespace: profileConfiguration.namespace,
					},
					requestContext,
				);

				const client = await connectionManager.getClient(effectiveProfile);
				const handle = client.workflow.getHandle(workflowId);
				const description = await handle.describe();
				const result = {
					contents: [jsonResourceContent(uri, description)],
				};
				auditLogger.logToolResult(
					requestContext,
					'success',
					Date.now() - startTime,
				);
				return result;
			} catch (error) {
				logToolCallOnce(
					context,
					requestContext,
					{ profile: profile || undefined, workflowId },
					loggingState,
				);
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
