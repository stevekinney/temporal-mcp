import type { PolicyConfig, PolicyDecision } from '../contracts/policy.ts';
import type { ToolContract } from '../contracts/tool-contract.ts';
import { matchesAnyPattern } from './pattern-match.ts';

export interface PolicyEvaluationContext {
	profile?: string;
	namespace?: string;
}

export function evaluatePolicy(
	config: PolicyConfig,
	toolContract: ToolContract,
	context: PolicyEvaluationContext,
): PolicyDecision {
	// 1. Hard read-only check
	if (config.hardReadOnly && toolContract.risk !== 'read') {
		return {
			allowed: false,
			reason: `Hard read-only mode blocks ${toolContract.risk} operations`,
			code: 'HARD_READ_ONLY',
		};
	}

	// 2. Deny patterns
	if (
		config.denyPatterns.length > 0 &&
		matchesAnyPattern(toolContract.name, config.denyPatterns)
	) {
		return {
			allowed: false,
			reason: `Tool "${toolContract.name}" matches a deny pattern`,
			code: 'DENY_PATTERN',
		};
	}

	// 3. Allow patterns (empty list means allow all)
	if (
		config.allowPatterns.length > 0 &&
		!matchesAnyPattern(toolContract.name, config.allowPatterns)
	) {
		return {
			allowed: false,
			reason: `Tool "${toolContract.name}" does not match any allow pattern`,
			code: 'DENY_PATTERN',
		};
	}

	// 4. Mode check
	const modeDecision = evaluateMode(config, toolContract);
	if (modeDecision !== null) {
		return modeDecision;
	}

	// 5. Profile allowlist (empty means allow all)
	if (
		config.allowedProfiles.length > 0 &&
		context.profile !== undefined &&
		!config.allowedProfiles.includes(context.profile)
	) {
		return {
			allowed: false,
			reason: `Profile "${context.profile}" is not in the allowed profiles list`,
			code: 'PROFILE_NOT_ALLOWED',
		};
	}

	// 6. Namespace allowlist (empty means allow all)
	if (
		config.allowedNamespaces.length > 0 &&
		context.namespace !== undefined &&
		!config.allowedNamespaces.includes(context.namespace)
	) {
		return {
			allowed: false,
			reason: `Namespace "${context.namespace}" is not in the allowed namespaces list`,
			code: 'NAMESPACE_NOT_ALLOWED',
		};
	}

	// 7. Allowed
	return {
		allowed: true,
		reason: 'Policy check passed',
		code: 'ALLOWED',
	};
}

function evaluateMode(
	config: PolicyConfig,
	toolContract: ToolContract,
): PolicyDecision | null {
	switch (config.mode) {
		case 'readOnly': {
			if (toolContract.risk !== 'read') {
				return {
					allowed: false,
					reason: `Read-only mode blocks ${toolContract.risk} operations`,
					code: 'MODE_BLOCKED',
				};
			}
			return null;
		}
		case 'safeWrite': {
			if (
				toolContract.risk === 'destructive' ||
				toolContract.risk === 'admin'
			) {
				return {
					allowed: false,
					reason: `Safe-write mode blocks ${toolContract.risk} operations`,
					code: 'MODE_BLOCKED',
				};
			}
			return null;
		}
		case 'custom': {
			// Custom mode defers entirely to allow/deny patterns (already handled above)
			return null;
		}
		case 'unsafe': {
			const breakGlassValue = process.env[config.breakGlassVariable];
			if (!breakGlassValue) {
				return {
					allowed: false,
					reason: `Unsafe mode requires the "${config.breakGlassVariable}" environment variable to be set`,
					code: 'BREAK_GLASS_REQUIRED',
				};
			}
			return null;
		}
	}
}
