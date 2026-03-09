import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceRegistrationContext } from './register.ts';

type Variables = Record<string, string | string[]>;

export function registerDocsResources(
	context: ResourceRegistrationContext,
): void {
	const { server } = context;

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
		async (uri: URL, variables: Variables) => {
			const sourcePath = String(variables.sourcePath ?? '');
			const { getDoc } = await import(
				'../../../docs/src/tools/get.ts'
			);
			const content = await getDoc({ sourcePath });
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'text/markdown',
						text: content,
					},
				],
			};
		},
	);
}
