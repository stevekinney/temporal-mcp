import { join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { chunkDocument } from '../chunking.ts';
import type { DocChunk } from '../chunking.ts';
import { createSearchIndex, persistIndex } from '../indexing.ts';
import { syncDocs } from '../sync.ts';
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

	const index = createSearchIndex(chunks);
	await persistIndex(index);

	const sdkFilter = [
		...new Set(
			chunks
				.map((chunk) => chunk.sdk)
				.filter((sdk): sdk is string => sdk !== null),
		),
	];
	await persistDocsStatusMetadata(chunks.length, sdkFilter);
	return getDocsStatus(chunks.length, sdkFilter);
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
