export {
	syncDocs,
	getSyncMetadata,
	getCorpusPath,
	getSyncMetaPath,
} from './sync.ts';
export type { SyncMetadata } from './sync.ts';

export { detectSdks } from './detect.ts';
export type { SdkSlug, DetectionResult } from './detect.ts';

export {
	chunkDocument,
	stripFrontmatter,
	stripMdxComponents,
	stripAdmonitions,
} from './chunking.ts';
export type { DocChunk } from './chunking.ts';

export {
	createSearchIndex,
	searchIndex,
	persistIndex,
	loadPersistedIndex,
} from './indexing.ts';
export type { SearchResult } from './indexing.ts';

export { getDocsStatus } from './tools/status.ts';
export type { DocsStatus } from './tools/status.ts';

export { searchDocs } from './tools/search.ts';
export type { DocSearchInput } from './tools/search.ts';

export { getDoc, validateDocPath } from './tools/get.ts';
export type { DocGetInput } from './tools/get.ts';

export { refreshDocs } from './tools/refresh.ts';
