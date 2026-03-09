export interface DocChunk {
	title: string;
	headingPath: string[];
	text: string;
	sourcePath: string;
	sdk: string | null;
	section: string | null;
}

export function stripFrontmatter(content: string): string {
	// Remove YAML frontmatter between --- markers
	return content.replace(/^---[\s\S]*?---\n?/, '');
}

export function stripMdxComponents(content: string): string {
	// Remove import statements
	let result = content.replace(/^import\s+.*$/gm, '');
	// Remove JSX-like components (self-closing and paired)
	result = result.replace(/<[A-Z][a-zA-Z]*\s*\/>/g, '');
	result = result.replace(
		/<[A-Z][a-zA-Z]*[^>]*>[\s\S]*?<\/[A-Z][a-zA-Z]*>/g,
		'',
	);
	return result;
}

export function stripAdmonitions(content: string): string {
	// Convert :::note/tip/warning/etc to just the content
	return content.replace(/^:::\w+.*$/gm, '').replace(/^:::$/gm, '');
}

export function chunkDocument(
	content: string,
	sourcePath: string,
	sdk: string | null = null,
): DocChunk[] {
	const cleaned = stripAdmonitions(stripMdxComponents(stripFrontmatter(content)));

	const chunks: DocChunk[] = [];
	const headingRegex = /^(#{1,3})\s+(.+)$/gm;
	const headingPath: string[] = [];

	let lastIndex = 0;
	let lastTitle =
		sourcePath.split('/').pop()?.replace(/\.\w+$/, '') ?? 'untitled';
	let match: RegExpExecArray | null;

	// Determine section from path
	const section = extractSection(sourcePath);

	while ((match = headingRegex.exec(cleaned)) !== null) {
		// Save text between last heading and this one
		const text = cleaned.slice(lastIndex, match.index).trim();
		if (text.length > 0) {
			chunks.push({
				title: lastTitle,
				headingPath: [...headingPath],
				text,
				sourcePath,
				sdk,
				section,
			});
		}

		const level = match[1]!.length;
		const title = match[2]!.trim();

		// Update heading path
		while (headingPath.length >= level) headingPath.pop();
		headingPath.push(title);

		lastTitle = title;
		lastIndex = match.index + match[0].length;
	}

	// Don't forget the last chunk
	const lastText = cleaned.slice(lastIndex).trim();
	if (lastText.length > 0) {
		chunks.push({
			title: lastTitle,
			headingPath: [...headingPath],
			text: lastText,
			sourcePath,
			sdk,
			section,
		});
	}

	return chunks;
}

function extractSection(sourcePath: string): string | null {
	const parts = sourcePath.split('/');
	// Look for common section names in the path
	const sectionKeywords = [
		'concepts',
		'develop',
		'production',
		'references',
		'encyclopedia',
		'cli',
		'cloud',
	];
	for (const part of parts) {
		if (sectionKeywords.includes(part.toLowerCase())) return part.toLowerCase();
	}
	return null;
}
