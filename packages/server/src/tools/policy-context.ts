import type { ToolRegistrationContext } from './register-all.ts';

export interface TemporalPolicyScope {
	profile: string;
	namespace: string;
}

export function resolveTemporalPolicyScope(
	context: ToolRegistrationContext,
	profile: string | undefined,
	namespace?: string,
): TemporalPolicyScope {
	const effectiveProfile = context.connectionManager.resolveProfileName(profile);
	const profileConfiguration =
		context.connectionManager.getProfileConfiguration(effectiveProfile);

	return {
		profile: effectiveProfile,
		namespace: namespace ?? profileConfiguration.namespace,
	};
}
