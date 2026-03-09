import { getToolContract } from '../../../temporal/src/capability-matrix.ts';
import { evaluatePolicy } from '../policy/evaluate.ts';
import type { ResourceRegistrationContext } from './register.ts';
import { redactSensitiveFields } from '../safety/redaction.ts';

export type ResourceTemplateVariables = Record<string, string | string[]>;

export interface ResourcePolicyScope {
	profile?: string;
	namespace?: string;
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
): void {
	const contract = getToolContract(toolName);
	if (!contract) return;

	const decision = evaluatePolicy(context.config.policy, contract, scope);
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
