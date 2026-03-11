import { describe, expect, mock, test } from 'bun:test';
import { DEFAULT_APP_CONFIG } from '../../src/config/schema.ts';
import type { ResourceRegistrationContext } from '../../src/resources/register.ts';
import { registerNamespaceResources } from '../../src/resources/namespace-resources.ts';
import { registerScheduleResources } from '../../src/resources/schedule-resources.ts';
import { registerTaskQueueResources } from '../../src/resources/task-queue-resources.ts';
import { registerWorkflowResources } from '../../src/resources/workflow-resources.ts';

type ResourceHandler = (
	uri: URL,
	variables: Record<string, string>,
) => Promise<unknown>;

interface RegistrationHarness {
	context: ResourceRegistrationContext;
	getHandler: (name: string) => ResourceHandler;
	auditLogger: {
		logToolCall: ReturnType<typeof mock>;
		logToolResult: ReturnType<typeof mock>;
		logPolicyDecision: ReturnType<typeof mock>;
	};
	connectionManager: {
		resolveProfileName: ReturnType<typeof mock>;
		getProfileConfiguration: ReturnType<typeof mock>;
		getClient: ReturnType<typeof mock>;
	};
}

function createRegistrationHarness(): RegistrationHarness {
	const handlers = new Map<string, ResourceHandler>();

	const server = {
		registerResource: (
			name: string,
			_template: unknown,
			_metadata: unknown,
			handler: ResourceHandler,
		) => {
			handlers.set(name, handler);
		},
	} as any;

	const connectionClient = {
		workflow: {
			getHandle: () => ({
				describe: async () => ({ workflowId: 'wf-1' }),
			}),
		},
		schedule: {
			getHandle: () => ({
				describe: async () => ({ scheduleId: 'schedule-1' }),
			}),
		},
		workflowService: {
			describeTaskQueue: async () => ({}),
			describeNamespace: async () => ({}),
		},
	};

	const connectionManager = {
		resolveProfileName: mock((profile?: string) => profile ?? 'local'),
		getProfileConfiguration: mock(() => ({ namespace: 'default' })),
		getClient: mock(async () => connectionClient),
	};

	const auditLogger = {
		logToolCall: mock(() => {}),
		logToolResult: mock(() => {}),
		logPolicyDecision: mock(() => {}),
	};

	const context: ResourceRegistrationContext = {
		server,
		connectionManager: connectionManager as any,
		config: DEFAULT_APP_CONFIG,
		auditLogger: auditLogger as any,
	};

	return {
		context,
		getHandler: (name: string) => {
			const handler = handlers.get(name);
			if (!handler) {
				throw new Error(`Handler not registered: ${name}`);
			}
			return handler;
		},
		auditLogger,
		connectionManager,
	};
}

describe('resource registration handlers', () => {
	const failingCases = [
		{
			name: 'temporal-workflow',
			register: registerWorkflowResources,
			variables: { profile: 'missing', workflowId: 'wf-1' },
		},
		{
			name: 'temporal-schedule',
			register: registerScheduleResources,
			variables: { profile: 'missing', scheduleId: 'schedule-1' },
		},
		{
			name: 'temporal-task-queue',
			register: registerTaskQueueResources,
			variables: { profile: 'missing', taskQueue: 'queue-1' },
		},
		{
			name: 'temporal-namespace',
			register: registerNamespaceResources,
			variables: { profile: 'missing', namespace: 'default' },
		},
	] as const;

	for (const failingCase of failingCases) {
		test(`${failingCase.name} logs call and error result when profile resolution fails`, async () => {
			const harness = createRegistrationHarness();
			const thrownError = {
				ok: false,
				error: {
					code: 'PROFILE_NOT_FOUND',
					message: 'missing profile',
					retryable: false,
				},
			};
			harness.connectionManager.resolveProfileName = mock(() => {
				throw thrownError;
			});
			harness.context.connectionManager = harness.connectionManager as any;

			failingCase.register(harness.context);
			const handler = harness.getHandler(failingCase.name);

			let caughtError: unknown;
			try {
				await handler(new URL('temporal:///resource'), failingCase.variables);
			} catch (error) {
				caughtError = error;
			}

			expect(caughtError).toEqual(thrownError);
			expect(harness.auditLogger.logToolCall).toHaveBeenCalledTimes(1);
			expect(harness.auditLogger.logToolResult).toHaveBeenCalledTimes(1);
			expect(harness.auditLogger.logToolResult).toHaveBeenCalledWith(
				expect.anything(),
				'error',
				expect.any(Number),
			);
		});
	}

	test('temporal-workflow success path returns resource content', async () => {
		const harness = createRegistrationHarness();
		registerWorkflowResources(harness.context);
		const handler = harness.getHandler('temporal-workflow');

		const result = (await handler(new URL('temporal:///resource'), {
			profile: 'local',
			workflowId: 'wf-1',
		})) as {
			contents: Array<{ mimeType: string }>;
		};

		expect(result.contents).toHaveLength(1);
		expect(result.contents[0]!.mimeType).toBe('application/json');
		expect(harness.auditLogger.logToolCall).toHaveBeenCalledTimes(1);
		expect(harness.auditLogger.logToolResult).toHaveBeenCalledWith(
			expect.anything(),
			'success',
			expect.any(Number),
		);
	});
});
