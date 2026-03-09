/**
 * Matches a tool name against a glob-like pattern.
 *
 * Pattern syntax:
 * - `*` matches exactly one segment (between dots)
 * - `**` matches one or more segments
 * - Literal segments match exactly
 *
 * Examples:
 * - `temporal.workflow.*` matches `temporal.workflow.list` but NOT `temporal.workflow.history.get`
 * - `temporal.**` matches `temporal.workflow.list` and `temporal.workflow.history.get`
 * - `temporal.workflow.list` matches exactly `temporal.workflow.list`
 */
export function matchesPattern(toolName: string, pattern: string): boolean {
	const toolSegments = toolName.split('.');
	const patternSegments = pattern.split('.');

	return matchSegments(toolSegments, 0, patternSegments, 0);
}

function matchSegments(
	toolSegments: string[],
	toolIndex: number,
	patternSegments: string[],
	patternIndex: number,
): boolean {
	// Both exhausted — match
	if (
		toolIndex === toolSegments.length &&
		patternIndex === patternSegments.length
	) {
		return true;
	}

	// Pattern exhausted but tool segments remain — no match
	if (patternIndex === patternSegments.length) {
		return false;
	}

	// Tool segments exhausted but pattern segments remain — no match
	if (toolIndex === toolSegments.length) {
		return false;
	}

	const currentPattern = patternSegments[patternIndex];

	if (currentPattern === '**') {
		// `**` matches one or more segments — try consuming 1..N tool segments
		for (let i = toolIndex + 1; i <= toolSegments.length; i++) {
			if (matchSegments(toolSegments, i, patternSegments, patternIndex + 1)) {
				return true;
			}
		}
		return false;
	}

	if (currentPattern === '*') {
		// `*` matches exactly one segment
		return matchSegments(
			toolSegments,
			toolIndex + 1,
			patternSegments,
			patternIndex + 1,
		);
	}

	// Literal match
	if (toolSegments[toolIndex] === currentPattern) {
		return matchSegments(
			toolSegments,
			toolIndex + 1,
			patternSegments,
			patternIndex + 1,
		);
	}

	return false;
}

export function matchesAnyPattern(
	toolName: string,
	patterns: string[],
): boolean {
	return patterns.some((pattern) => matchesPattern(toolName, pattern));
}
