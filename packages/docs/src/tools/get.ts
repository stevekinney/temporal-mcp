import { join, resolve, relative } from 'node:path';
import { getCorpusPath } from '../sync.ts';

export interface DocGetInput {
	sourcePath: string;
}

export function validateDocPath(
	corpusPath: string,
	sourcePath: string,
): string {
	const fullPath = resolve(join(corpusPath, sourcePath));

	// Prevent path traversal
	const rel = relative(corpusPath, fullPath);
	if (rel.startsWith('..') || resolve(fullPath) !== fullPath) {
		throw {
			ok: false,
			error: {
				code: 'PATH_TRAVERSAL',
				message: `Invalid path: "${sourcePath}" resolves outside the docs corpus`,
				retryable: false,
			},
		};
	}

	return fullPath;
}

export async function getDoc(input: DocGetInput): Promise<string> {
	const corpusPath = getCorpusPath();
	const fullPath = validateDocPath(corpusPath, input.sourcePath);

	const file = Bun.file(fullPath);
	if (!(await file.exists())) {
		throw {
			ok: false,
			error: {
				code: 'DOC_NOT_FOUND',
				message: `Document not found: ${input.sourcePath}`,
				retryable: false,
			},
		};
	}

	return await file.text();
}
