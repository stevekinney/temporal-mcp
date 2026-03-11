import { Glob } from 'bun';
import { join } from 'node:path';
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
		const content = await Bun.file(fullPath).text();
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
	for (const pattern of ['**/*.md', '**/*.mdx']) {
		const glob = new Glob(pattern);
		for await (const path of glob.scan({
			cwd: corpusPath,
			onlyFiles: true,
		})) {
			sourcePaths.add(path.replaceAll('\\', '/'));
		}
	}
	return [...sourcePaths];
}
