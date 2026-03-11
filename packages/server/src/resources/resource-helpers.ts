import { evaluatePolicy } from '../policy/evaluate.ts';
import type { ResourceRegistrationContext } from './register.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';
import type { RequestContext } from '../safety/request-context.ts';
import { requireToolContract } from '../tools/tool-contract.ts';

export type ResourceTemplateVariables = Record<string, string | string[]>;

export interface ResourcePolicyScope {
	profile?: string;
	namespace?: string;
}

export interface ResourceCallLoggingState {
	hasLoggedToolCall: boolean;
}

export function getVariable(
	variables: ResourceTemplateVariables,
	key: string,
): string {
	const value = variables[key];
	return Array.isArray(value)
		? String(value[0] ?? '')
		: String(value ?? '');
}

export function assertResourcePolicy(
	context: ResourceRegistrationContext,
	toolName: string,
	scope: ResourcePolicyScope,
	requestContext?: RequestContext,
): void {
	const contract = requireToolContract(toolName);

	const decision = evaluatePolicy(context.config.policy, contract, scope);
	if (requestContext) {
		context.auditLogger.logPolicyDecision(requestContext, decision);
	}
	if (!decision.allowed) {
		throw {
			ok: false,
			error: {
				code: decision.code,
				message: decision.reason,
				retryable: false,
			},
		};
	}
}

export function jsonResourceContent(
	uri: URL,
	payload: unknown,
): { uri: string; mimeType: string; text: string } {
	return {
		uri: uri.href,
		mimeType: 'application/json',
		text: JSON.stringify(redactSensitiveFields(payload), null, 2),
	};
}

export function logToolCallOnce(
	context: ResourceRegistrationContext,
	requestContext: RequestContext,
	args: Record<string, unknown>,
	state: ResourceCallLoggingState,
): void {
	if (state.hasLoggedToolCall) return;
	context.auditLogger.logToolCall(requestContext, args);
	state.hasLoggedToolCall = true;
}
