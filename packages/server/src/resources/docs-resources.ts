import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';
import {
	assertResourcePolicy,
	getVariable,
	type ResourceTemplateVariables,
} from './resource-helpers.ts';

export function registerDocsResources(
	context: ResourceRegistrationContext,
): void {
	const { server, auditLogger } = context;

	server.registerResource(
		'temporal-docs',
		new ResourceTemplate('docs:///chunk/{sourcePath}', {
			list: undefined,
		}),
		{
			description:
				'A documentation page from the Temporal docs corpus',
			mimeType: 'text/markdown',
		},
		async (uri: URL, variables: ResourceTemplateVariables) => {
			const sourcePath = getVariable(variables, 'sourcePath');
			const requestContext = buildRequestContext('resource.temporal-docs', {
				sourcePath,
			});
			auditLogger.logToolCall(requestContext, { sourcePath });
			const startTime = Date.now();

			try {
				assertResourcePolicy(context, 'docs.get', {}, requestContext);

				const { getDoc } = await import(
					'../../../docs/src/tools/get.ts'
				);
				const content = await getDoc({ sourcePath });
				const redactedContent = redactSensitiveFields({
					content,
				}) as { content: string };
				const result = {
					contents: [
						{
							uri: uri.href,
							mimeType: 'text/markdown',
							text: redactedContent.content,
						},
					],
				};
				auditLogger.logToolResult(
					requestContext,
					'success',
					Date.now() - startTime,
				);
				return result;
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
