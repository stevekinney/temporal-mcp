import { describe, expect, test } from 'bun:test';
import { requestConfirmation } from '../../src/elicitation/confirmation.ts';

function createMockServer(options: {
	hasElicitation?: boolean;
	elicitResult?: { action: string; content: { confirmed: boolean } };
	elicitThrows?: boolean;
	capabilityThrows?: boolean;
}) {
	const server = {
		server: {
			getClientCapabilities: options.capabilityThrows
				? () => {
						throw new Error('capability check failed');
					}
				: () => ({
						elicitation: options.hasElicitation ?? false,
					}),
			elicitInput: options.elicitThrows
				? async () => {
						throw new Error('elicitation failed');
					}
				: async () => options.elicitResult,
		},
	};
	return server as any;
}

describe('requestConfirmation', () => {
	test('returns ELICITATION_UNAVAILABLE when client lacks capability', async () => {
		const server = createMockServer({ hasElicitation: false });
		const result = await requestConfirmation(
			server,
			'temporal.workflow.terminate',
			'Terminate workflow wf-1',
		);

		expect(result.confirmed).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error!.error.code).toBe('ELICITATION_UNAVAILABLE');
		expect(result.error!.error.message).toContain(
			'temporal.workflow.terminate',
		);
	});

	test('returns ELICITATION_UNAVAILABLE when capability check throws', async () => {
		const server = createMockServer({ capabilityThrows: true });
		const result = await requestConfirmation(
			server,
			'temporal.workflow.terminate',
			'Terminate workflow',
		);

		expect(result.confirmed).toBe(false);
		expect(result.error!.error.code).toBe('ELICITATION_UNAVAILABLE');
	});

	test('returns confirmed: true when elicitation succeeds', async () => {
		const server = createMockServer({
			hasElicitation: true,
			elicitResult: {
				action: 'accept',
				content: { confirmed: true },
			},
		});
		const result = await requestConfirmation(
			server,
			'temporal.workflow.terminate',
			'Terminate workflow wf-1',
		);

		expect(result.confirmed).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test('returns CONFIRMATION_DENIED when user declines', async () => {
		const server = createMockServer({
			hasElicitation: true,
			elicitResult: {
				action: 'accept',
				content: { confirmed: false },
			},
		});
		const result = await requestConfirmation(
			server,
			'temporal.workflow.terminate',
			'Terminate workflow wf-1',
		);

		expect(result.confirmed).toBe(false);
		expect(result.error!.error.code).toBe('CONFIRMATION_DENIED');
	});

	test('returns ELICITATION_FAILED when elicitation throws', async () => {
		const server = createMockServer({
			hasElicitation: true,
			elicitThrows: true,
		});
		const result = await requestConfirmation(
			server,
			'temporal.workflow.terminate',
			'Terminate workflow wf-1',
		);

		expect(result.confirmed).toBe(false);
		expect(result.error!.error.code).toBe('ELICITATION_FAILED');
		expect(result.error!.error.retryable).toBe(true);
	});
});
