import { join } from 'node:path';
import { readdir, readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { chunkDocument } from '../chunking.ts';
import type { DocChunk } from '../chunking.ts';
import { createSearchIndex, persistIndex } from '../indexing.ts';
import { syncDocs, getSkillReferencesPath } from '../sync.ts';
import { getDocsStatus } from './status.ts';
import { persistDocsStatusMetadata } from './status.ts';
import type { DocsStatus } from './status.ts';

export async function refreshDocs(): Promise<DocsStatus> {
	const syncMetadata = await syncDocs();
	const sourcePaths = await collectMarkdownSourcePaths(syncMetadata.corpusPath);

	const chunks: DocChunk[] = [];
	for (const sourcePath of sourcePaths) {
		const fullPath = join(syncMetadata.corpusPath, sourcePath);
		const content = await readFile(fullPath, 'utf8');
		chunks.push(...chunkDocument(content, sourcePath));
	}

	// Also index curated skill reference files if the skill directory exists.
	const skillChunks = await collectSkillChunks();
	chunks.push(...skillChunks);

	const index = createSearchIndex(chunks);
	await persistIndex(index);

	const sdkFilter = [
		...new Set(
			chunks
				.map((chunk) => chunk.sdk)
				.filter((sdk): sdk is string => sdk !== null),
		),
	];
	await persistDocsStatusMetadata(chunks.length, sdkFilter, homedir(), skillChunks.length);
	return getDocsStatus(chunks.length, sdkFilter);
}

async function collectSkillChunks(): Promise<DocChunk[]> {
	const skillRoot = getSkillReferencesPath();

	try {
		await access(skillRoot, constants.F_OK);
	} catch {
		// Skill directory is optional — silently skip if absent.
		return [];
	}

	const chunks: DocChunk[] = [];
	const sourcePaths = await collectMarkdownSourcePaths(skillRoot);

	for (const relativePath of sourcePaths) {
		const fullPath = join(skillRoot, relativePath);
		const content = await readFile(fullPath, 'utf8');
		// Prefix with 'skill/references/' so docs.get can route these correctly.
		const sourcePath = `skill/references/${relativePath}`;
		const sdk = inferSkillSdk(relativePath);
		const rawChunks = chunkDocument(content, sourcePath);
		// Override sdk and section for curated content.
		chunks.push(
			...rawChunks.map((chunk) => ({
				...chunk,
				sdk: sdk ?? chunk.sdk,
				section: 'curated',
			})),
		);
	}

	return chunks;
}

function inferSkillSdk(relativePath: string): string | null {
	const normalized = relativePath.replace(/\\/g, '/');
	if (normalized.startsWith('typescript/')) return 'typescript';
	if (normalized.startsWith('python/')) return 'python';
	if (normalized.startsWith('go/')) return 'go';
	return null;
}

async function collectMarkdownSourcePaths(corpusPath: string): Promise<string[]> {
	const sourcePaths = new Set<string>();

	async function walk(relativeDirectoryPath: string): Promise<void> {
		const directoryPath =
			relativeDirectoryPath.length === 0
				? corpusPath
				: join(corpusPath, relativeDirectoryPath);

		const entries = await readdir(directoryPath, { withFileTypes: true });
		for (const entry of entries) {
			// Match prior Glob defaults by excluding hidden files/directories.
			if (entry.name.startsWith('.')) {
				continue;
			}

			const relativePath =
				relativeDirectoryPath.length === 0
					? entry.name
					: join(relativeDirectoryPath, entry.name);

			if (entry.isDirectory()) {
				await walk(relativePath);
				continue;
			}

			if (
				entry.isFile() &&
				(relativePath.endsWith('.md') || relativePath.endsWith('.mdx'))
			) {
				sourcePaths.add(relativePath.replaceAll('\\', '/'));
			}
		}
	}

	await walk('');
	return [...sourcePaths];
}
