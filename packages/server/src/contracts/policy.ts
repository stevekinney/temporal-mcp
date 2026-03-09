export type PolicyMode = 'readOnly' | 'safeWrite' | 'custom' | 'unsafe';

export interface PolicyConfig {
	mode: PolicyMode;
	hardReadOnly: boolean;
	allowedProfiles: string[];
	allowedNamespaces: string[];
	allowPatterns: string[];
	denyPatterns: string[];
	breakGlassVariable: string;
}

export interface PolicyDecision {
	allowed: boolean;
	reason: string;
	code:
		| 'ALLOWED'
		| 'HARD_READ_ONLY'
		| 'MODE_BLOCKED'
		| 'DENY_PATTERN'
		| 'PROFILE_NOT_ALLOWED'
		| 'NAMESPACE_NOT_ALLOWED'
		| 'BREAK_GLASS_REQUIRED';
}
