const INLINE_THRESHOLD_BYTES = 32 * 1024; // 32KB

export interface InlineCheckResult {
	inline: boolean;
	summary?: string;
	resourceUri?: string;
}

export function checkInlineThreshold(
	data: unknown,
	resourceUri: string,
): InlineCheckResult {
	const json = JSON.stringify(data, null, 2);
	const bytes = new TextEncoder().encode(json).length;

	if (bytes <= INLINE_THRESHOLD_BYTES) {
		return { inline: true };
	}

	const summary =
		typeof data === 'object' && data !== null
			? `Response exceeds ${INLINE_THRESHOLD_BYTES / 1024}KB (${(bytes / 1024).toFixed(1)}KB). ` +
				`Keys: ${Object.keys(data as Record<string, unknown>).slice(0, 5).join(', ')}${Object.keys(data as Record<string, unknown>).length > 5 ? '...' : ''}. ` +
				`Full data available at: ${resourceUri}`
			: `Response exceeds ${INLINE_THRESHOLD_BYTES / 1024}KB. Full data available at: ${resourceUri}`;

	return { inline: false, summary, resourceUri };
}
