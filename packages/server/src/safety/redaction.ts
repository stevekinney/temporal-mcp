const DEFAULT_SENSITIVE_PATTERNS = [
	'apiKey',
	'password',
	'token',
	'secret',
	'credential',
	'authorization',
	'cookie',
	'session',
];

export function redactSensitiveFields(
	value: unknown,
	patterns: string[] = DEFAULT_SENSITIVE_PATTERNS,
): unknown {
	if (value === null || value === undefined) return value;
	if (typeof value !== 'object') return value;

	if (Array.isArray(value)) {
		return value.map((item) => redactSensitiveFields(item, patterns));
	}

	const result: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(
		value as Record<string, unknown>,
	)) {
		if (
			patterns.some((pattern) =>
				key.toLowerCase().includes(pattern.toLowerCase()),
			)
		) {
			result[key] = '[REDACTED]';
		} else {
			result[key] = redactSensitiveFields(val, patterns);
		}
	}
	return result;
}
