import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ErrorEnvelope } from '../contracts/error-envelope.ts';

export interface ConfirmationResult {
	confirmed: boolean;
	error?: ErrorEnvelope;
}

export async function requestConfirmation(
	server: McpServer,
	toolName: string,
	description: string,
	details?: Record<string, unknown>,
): Promise<ConfirmationResult> {
	// Check if client supports elicitation
	try {
		const capabilities = (server.server as any).getClientCapabilities?.();
		if (!capabilities?.elicitation) {
			return {
				confirmed: false,
				error: {
					ok: false,
					error: {
						code: 'ELICITATION_UNAVAILABLE',
						message: `Client does not support elicitation. Cannot confirm ${toolName}: ${description}`,
						retryable: false,
						details,
					},
				},
			};
		}
	} catch {
		return {
			confirmed: false,
			error: {
				ok: false,
				error: {
					code: 'ELICITATION_UNAVAILABLE',
					message: `Could not determine client capabilities for confirmation of ${toolName}`,
					retryable: false,
				},
			},
		};
	}

	// Attempt elicitation
	try {
		const result = await (server.server as any).elicitInput?.({
			message: `Confirm ${toolName}: ${description}`,
			requestedSchema: {
				type: 'object',
				properties: {
					confirmed: {
						type: 'boolean',
						description: 'Confirm this operation?',
					},
				},
				required: ['confirmed'],
			},
		});

		if (result?.action === 'accept' && result?.content?.confirmed) {
			return { confirmed: true };
		}

		return {
			confirmed: false,
			error: {
				ok: false,
				error: {
					code: 'CONFIRMATION_DENIED',
					message: `User did not confirm ${toolName}: ${description}`,
					retryable: false,
				},
			},
		};
	} catch {
		return {
			confirmed: false,
			error: {
				ok: false,
				error: {
					code: 'ELICITATION_FAILED',
					message: `Elicitation failed for ${toolName}`,
					retryable: true,
				},
			},
		};
	}
}
