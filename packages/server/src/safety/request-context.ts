export interface RequestContext {
	requestId: string;
	toolName: string;
	timestamp: string;
	profile?: string;
	sessionId?: string;
}

export function buildRequestContext(
	toolName: string,
	args: Record<string, unknown>,
	extra?: { requestId?: string | number; sessionId?: string },
): RequestContext {
	return {
		requestId:
			extra?.requestId != null
				? String(extra.requestId)
				: crypto.randomUUID(),
		toolName,
		timestamp: new Date().toISOString(),
		profile: typeof args.profile === 'string' ? args.profile : undefined,
		sessionId: extra?.sessionId,
	};
}
