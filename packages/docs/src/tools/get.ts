import { isAbsolute, join, resolve, relative } from 'node:path';
import { access, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { getCorpusPath, getSkillReferencesPath } from '../sync.ts';

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
	// Skill reference files are served from the skill root, not the docs corpus.
	const normalizedSourcePath = input.sourcePath.replace(/\\/g, '/');
	if (normalizedSourcePath.startsWith('skill/references/')) {
		return getSkillDoc(normalizedSourcePath);
	}

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

async function getSkillDoc(sourcePath: string): Promise<string> {
	const skillReferencesPath = getSkillReferencesPath();

	// Strip the 'skill/references/' prefix to get the path relative to references root.
	const relativePath = sourcePath.slice('skill/references/'.length);

	// Validate: no traversal beyond the references root.
	const fullPath = resolve(join(skillReferencesPath, relativePath));
	const rel = relative(skillReferencesPath, fullPath);
	if (isOutsideCorpus(rel)) {
		throwPathTraversalError(sourcePath);
	}

	// Symlink-escape protection.
	try {
		const [resolvedRoot, resolvedFile] = await Promise.all([
			realpath(skillReferencesPath),
			realpath(fullPath),
		]);
		const resolvedRel = relative(resolvedRoot, resolvedFile);
		if (isOutsideCorpus(resolvedRel)) {
			throwPathTraversalError(sourcePath);
		}
	} catch (error: unknown) {
		// realpath fails if path doesn't exist — convert to a NOT_FOUND error.
		if (
			typeof error === 'object' &&
			error !== null &&
			'ok' in error
		) {
			throw error;
		}
		throw {
			ok: false,
			error: {
				code: 'DOC_NOT_FOUND',
				message: `Skill reference not found: ${sourcePath}`,
				retryable: false,
			},
		};
	}

	try {
		await access(fullPath, constants.F_OK);
	} catch {
		throw {
			ok: false,
			error: {
				code: 'DOC_NOT_FOUND',
				message: `Skill reference not found: ${sourcePath}`,
				retryable: false,
			},
		};
	}

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
