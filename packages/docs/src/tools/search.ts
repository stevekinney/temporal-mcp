import type MiniSearch from 'minisearch';
import { searchIndex } from '../indexing.ts';
import type { SearchResult } from '../indexing.ts';

export interface DocSearchInput {
	query: string;
	sdk?: string;
	limit?: number;
}

export function searchDocs(
	index: MiniSearch,
	input: DocSearchInput,
): SearchResult[] {
	return searchIndex(index, input.query, {
		sdk: input.sdk,
		limit: input.limit,
	});
}
