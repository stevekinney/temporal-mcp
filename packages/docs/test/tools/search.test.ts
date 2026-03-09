import { describe, expect, test } from 'bun:test';
import { searchDocs } from '../../src/tools/search.ts';
import { createSearchIndex } from '../../src/indexing.ts';
import type { DocChunk } from '../../src/chunking.ts';

function makeChunks(): DocChunk[] {
	return [
		{
			title: 'Workflow Basics',
			headingPath: ['Concepts', 'Workflow Basics'],
			text: 'A Temporal Workflow defines the overall flow of your application logic.',
			sourcePath: 'docs/concepts/workflows.md',
			sdk: null,
			section: 'concepts',
		},
		{
			title: 'Activity Basics',
			headingPath: ['Concepts', 'Activity Basics'],
			text: 'Activities are the mechanism for interacting with external systems.',
			sourcePath: 'docs/concepts/activities.md',
			sdk: null,
			section: 'concepts',
		},
	];
}

describe('searchDocs', () => {
	test('delegates to searchIndex and returns results', () => {
		const index = createSearchIndex(makeChunks());
		const results = searchDocs(index, { query: 'workflow' });
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]!.title).toContain('Workflow');
	});

	test('returns results for matching queries', () => {
		const index = createSearchIndex(makeChunks());
		const results = searchDocs(index, { query: 'activity external systems' });
		expect(results.length).toBeGreaterThan(0);
	});
});
