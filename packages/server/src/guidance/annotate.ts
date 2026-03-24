import { TOOL_GUIDANCE } from './patterns.ts';

export function annotateWithGuidance(toolName: string, data: unknown): unknown {
	if (typeof data !== 'object' || data === null) return data;

	const patterns = TOOL_GUIDANCE[toolName];
	if (!patterns || patterns.length === 0) return data;

	const match = patterns.find((pattern) => pattern.condition(data));
	if (!match) return data;

	return { ...(data as Record<string, unknown>), guidance: match.guidance };
}
