import { z } from 'zod/v4';
import type { ToolRegistrationContext } from './register-all.ts';
import { errorResponse, successResponse } from './response-helpers.ts';
import { buildRequestContext } from '../safety/request-context.ts';
import { evaluatePolicy } from '../policy/evaluate.ts';
import { getToolContract } from '../../../temporal/src/capability-matrix.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';
import { inputSchema } from './zod-compat.ts';

export function registerDocsTools(context: ToolRegistrationContext): void {
	const { server, config, auditLogger, taskStore } = context;

	server.registerTool(
		'docs.status',
		{
			description:
				'Check the status of the local Temporal documentation corpus.',
			inputSchema: {},
		},
		async (_args, extra) => {
			const requestContext = buildRequestContext('docs.status', {}, extra);
			auditLogger.logToolCall(requestContext, {});
			const startTime = Date.now();

			try {
				const contract = getToolContract('docs.status');
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, {});
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const { getDocsStatus } = await import(
					'../../../docs/src/tools/status.ts'
				);
				const status = await getDocsStatus();
				const result = successResponse(redactSensitiveFields(status));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'docs.search',
		{
			description:
				'Search the Temporal documentation corpus for relevant information.',
			inputSchema: inputSchema({
				query: z.string().describe('The search query'),
				sdk: z
					.string()
					.optional()
					.describe(
						'Filter results by SDK language (e.g. typescript, go, python)',
					),
				limit: z
					.number()
					.min(1)
					.max(50)
					.default(10)
					.describe('Maximum number of results to return'),
			}),
		},
		async ({ query, sdk, limit }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'docs.search',
				{ query, sdk, limit },
				extra,
			);
			auditLogger.logToolCall(requestContext, { query, sdk, limit });
			const startTime = Date.now();

			try {
				const contract = getToolContract('docs.search');
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, {});
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const { searchDocs } = await import(
					'../../../docs/src/tools/search.ts'
				);
				const { loadPersistedIndex } = await import(
					'../../../docs/src/indexing.ts'
				);
				const index = await loadPersistedIndex();
				if (!index) {
					return errorResponse({
						ok: false,
						error: {
							code: 'INDEX_NOT_AVAILABLE',
							message:
								'Documentation index not available. Run docs.refresh first.',
							retryable: true,
						},
					});
				}
				const results = searchDocs(index, { query, sdk, limit });
				const result = successResponse(redactSensitiveFields(results));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	server.registerTool(
		'docs.get',
		{
			description: 'Get the full content of a specific documentation page.',
			inputSchema: inputSchema({
				sourcePath: z
					.string()
					.describe(
						'The source path of the documentation page to retrieve',
					),
			}),
		},
		async ({ sourcePath }: any, extra: any) => {
			const requestContext = buildRequestContext(
				'docs.get',
				{ sourcePath },
				extra,
			);
			auditLogger.logToolCall(requestContext, { sourcePath });
			const startTime = Date.now();

			try {
				const contract = getToolContract('docs.get');
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, {});
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const { getDoc } = await import(
					'../../../docs/src/tools/get.ts'
				);
				const content = await getDoc({ sourcePath });
				const result = successResponse({ content });
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);

	if (config.mcp.capabilities.tasks && taskStore) {
		registerDocsRefreshWithTasks(context);
	} else {
		registerDocsRefreshSynchronous(context);
	}
}

function registerDocsRefreshSynchronous(context: ToolRegistrationContext): void {
	const { server, config, auditLogger } = context;

	server.registerTool(
		'docs.refresh',
		{
			description:
				'Refresh the local Temporal documentation corpus by syncing with the latest docs.',
			inputSchema: {},
		},
		async (_args, extra) => {
			const requestContext = buildRequestContext('docs.refresh', {}, extra);
			auditLogger.logToolCall(requestContext, {});
			const startTime = Date.now();

			try {
				const contract = getToolContract('docs.refresh');
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, {});
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const { refreshDocs } = await import(
					'../../../docs/src/tools/refresh.ts'
				);
				const status = await refreshDocs();
				const result = successResponse(redactSensitiveFields(status));
				auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
				return result;
			} catch (error) {
				auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
				return errorResponse(error);
			}
		},
	);
}

function registerDocsRefreshWithTasks(context: ToolRegistrationContext): void {
	const { server, config, auditLogger, taskStore } = context;

	server.experimental.tasks.registerToolTask(
		'docs.refresh',
		{
			description:
				'Refresh the local Temporal documentation corpus by syncing with the latest docs.',
			execution: { taskSupport: 'optional' as const },
		},
		{
			createTask: async (extra: any): Promise<any> => {
				const requestContext = buildRequestContext('docs.refresh', {}, extra);
				auditLogger.logToolCall(requestContext, {});

				const contract = getToolContract('docs.refresh');
				if (contract) {
					const decision = evaluatePolicy(config.policy, contract, {});
					auditLogger.logPolicyDecision(requestContext, decision);
					if (!decision.allowed) {
						auditLogger.logToolResult(requestContext, 'error', 0);
						return errorResponse({
							ok: false,
							error: { code: decision.code, message: decision.reason, retryable: false },
						});
					}
				}

				const ttl = config.security.maxTaskTtlSec * 1000;
				const task = await extra.taskStore.createTask({ ttl });

				// Kick off background refresh
				runBackgroundRefresh(task.taskId, taskStore!, auditLogger, requestContext);

				return { task };
			},
			getTask: async (extra: any): Promise<any> => {
				const task = await extra.taskStore.getTask(extra.taskId);
				return { task: task! };
			},
			getTaskResult: async (extra: any) => {
				return extra.taskStore.getTaskResult(extra.taskId);
			},
		},
	);
}

function runBackgroundRefresh(
	taskId: string,
	taskStore: NonNullable<ToolRegistrationContext['taskStore']>,
	auditLogger: ToolRegistrationContext['auditLogger'],
	requestContext: ReturnType<typeof buildRequestContext>,
): void {
	const startTime = Date.now();

	(async () => {
		try {
			const { refreshDocs } = await import(
				'../../../docs/src/tools/refresh.ts'
			);
			const status = await refreshDocs();
			const result = successResponse(redactSensitiveFields(status));
			await taskStore.storeTaskResult(taskId, 'completed', result);
			auditLogger.logToolResult(requestContext, 'success', Date.now() - startTime);
		} catch (error) {
			const result = errorResponse(error);
			await taskStore.storeTaskResult(taskId, 'failed', result);
			auditLogger.logToolResult(requestContext, 'error', Date.now() - startTime);
		}
	})();
}
