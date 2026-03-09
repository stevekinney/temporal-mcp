import MiniSearch from 'minisearch';
import type { DocChunk } from './chunking.ts';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir } from 'node:fs/promises';

export interface SearchResult {
	title: string;
	headingPath: string[];
	sourcePath: string;
	sdk: string | null;
	section: string | null;
	score: number;
	excerpt: string;
}

function getCacheDir(): string {
	return join(homedir(), '.temporal-mcp', 'cache');
}

function getIndexPath(): string {
	return join(getCacheDir(), 'docs-index.json');
}

export function createSearchIndex(chunks: DocChunk[]): MiniSearch {
	const miniSearch = new MiniSearch({
		fields: ['title', 'headingPath', 'text'],
		storeFields: ['title', 'headingPath', 'sourcePath', 'sdk', 'section'],
		idField: 'id',
		searchOptions: {
			boost: { title: 3, headingPath: 2 },
			fuzzy: 0.2,
			prefix: true,
		},
	});

	const documents = chunks.map((chunk, index) => ({
		id: index,
		title: chunk.title,
		headingPath: chunk.headingPath.join(' > '),
		text: chunk.text,
		sourcePath: chunk.sourcePath,
		sdk: chunk.sdk,
		section: chunk.section,
	}));

	miniSearch.addAll(documents);
	return miniSearch;
}

export function searchIndex(
	index: MiniSearch,
	query: string,
	options?: { sdk?: string; limit?: number },
): SearchResult[] {
	const results = index.search(query, {
		filter: options?.sdk
			? (result) => result.sdk === options.sdk || result.sdk === null
			: undefined,
	});

	const limit = options?.limit ?? 10;
	return results.slice(0, limit).map((result) => ({
		title: result.title,
		headingPath: result.headingPath ? result.headingPath.split(' > ') : [],
		sourcePath: result.sourcePath,
		sdk: result.sdk ?? null,
		section: result.section ?? null,
		score: result.score,
		excerpt: '', // MiniSearch doesn't store text by default; we'd need to reload
	}));
}

export async function persistIndex(index: MiniSearch): Promise<void> {
	const cacheDir = getCacheDir();
	await mkdir(cacheDir, { recursive: true });
	await Bun.write(getIndexPath(), JSON.stringify(index.toJSON()));
}

export async function loadPersistedIndex(): Promise<MiniSearch | null> {
	try {
		const file = Bun.file(getIndexPath());
		if (!(await file.exists())) return null;
		const data = await file.json();
		return MiniSearch.loadJSON(JSON.stringify(data), {
			fields: ['title', 'headingPath', 'text'],
			storeFields: ['title', 'headingPath', 'sourcePath', 'sdk', 'section'],
			idField: 'id',
		});
	} catch {
		return null;
	}
}
