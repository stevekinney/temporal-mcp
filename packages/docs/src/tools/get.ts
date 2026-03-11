import { isAbsolute, join, resolve, relative } from 'node:path';
import { access, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { getCorpusPath } from '../sync.ts';

export interface DocGetInput {
	sourcePath: string;
	corpusPath?: string;
}

export function validateDocPath(
	corpusPath: string,
	sourcePath: string,
): string {
	const fullPath = resolve(join(corpusPath, sourcePath));

	// Prevent path traversal
	const rel = relative(corpusPath, fullPath);
	if (isOutsideCorpus(rel)) {
		throwPathTraversalError(sourcePath);
	}

	return fullPath;
}

export async function getDoc(input: DocGetInput): Promise<string> {
	const corpusPath = input.corpusPath ?? getCorpusPath();
	const fullPath = validateDocPath(corpusPath, input.sourcePath);

	try {
		await access(fullPath, constants.F_OK);
	} catch {
		throw {
			ok: false,
			error: {
				code: 'DOC_NOT_FOUND',
				message: `Document not found: ${input.sourcePath}`,
				retryable: false,
			},
		};
	}

	await assertRealPathWithinCorpus(corpusPath, fullPath, input.sourcePath);
	return await readFile(fullPath, 'utf8');
}

function throwPathTraversalError(sourcePath: string): never {
	throw {
		ok: false,
		error: {
			code: 'PATH_TRAVERSAL',
			message: `Invalid path: "${sourcePath}" resolves outside the docs corpus`,
			retryable: false,
		},
	};
}

function isOutsideCorpus(relativePath: string): boolean {
	const normalizedRelativePath = relativePath.replace(/\\/g, '/');
	return (
		normalizedRelativePath === '..' ||
		normalizedRelativePath.startsWith('../') ||
		isAbsolute(relativePath) ||
		/^[A-Za-z]:\//.test(normalizedRelativePath)
	);
}

async function assertRealPathWithinCorpus(
	corpusPath: string,
	fullPath: string,
	sourcePath: string,
): Promise<void> {
	const [resolvedCorpusPath, resolvedFilePath] = await Promise.all([
		realpath(corpusPath),
		realpath(fullPath),
	]);
	const resolvedRelativePath = relative(resolvedCorpusPath, resolvedFilePath);
	if (isOutsideCorpus(resolvedRelativePath)) {
		throwPathTraversalError(sourcePath);
	}
}
