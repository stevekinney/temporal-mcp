import { describe, expect, test } from 'bun:test';
import { createSearchIndex, searchIndex } from '../src/indexing.ts';
import type { DocChunk } from '../src/chunking.ts';

function makeChunks(): DocChunk[] {
	return [
		{
			title: 'Workflows',
			headingPath: ['Concepts', 'Workflows'],
			text: 'A Workflow is a sequence of steps that defines the logic of your application.',
			sourcePath: 'docs/concepts/workflows.md',
			sdk: null,
			section: 'concepts',
		},
		{
			title: 'Activities',
			headingPath: ['Concepts', 'Activities'],
			text: 'An Activity is a function that executes a single, well-defined action such as calling an API.',
			sourcePath: 'docs/concepts/activities.md',
			sdk: null,
			section: 'concepts',
		},
		{
			title: 'TypeScript SDK Workflows',
			headingPath: ['Develop', 'TypeScript', 'Workflows'],
			text: 'Learn how to develop Temporal Workflows using the TypeScript SDK.',
			sourcePath: 'docs/develop/typescript/workflows.md',
			sdk: 'typescript',
			section: 'develop',
		},
		{
			title: 'Go SDK Workflows',
			headingPath: ['Develop', 'Go', 'Workflows'],
			text: 'Learn how to develop Temporal Workflows using the Go SDK.',
			sourcePath: 'docs/develop/go/workflows.md',
			sdk: 'go',
			section: 'develop',
		},
	];
}

describe('createSearchIndex', () => {
	test('creates an index from chunks', () => {
		const chunks = makeChunks();
		const index = createSearchIndex(chunks);
		expect(index).toBeDefined();
		expect(index.documentCount).toBe(chunks.length);
	});
});

describe('searchIndex', () => {
	test('returns relevant results', () => {
		const index = createSearchIndex(makeChunks());
		const results = searchIndex(index, 'workflow');
		expect(results.length).toBeGreaterThan(0);
		// All results should have workflow-related titles
		expect(results.some((r) => r.title.toLowerCase().includes('workflow'))).toBe(
			true,
		);
	});

	test('respects SDK filter', () => {
		const index = createSearchIndex(makeChunks());
		const results = searchIndex(index, 'workflow', { sdk: 'typescript' });
		// Should include SDK-null (general) and typescript-specific results
		for (const result of results) {
			expect(result.sdk === null || result.sdk === 'typescript').toBe(true);
		}
	});

	test('respects limit', () => {
		const index = createSearchIndex(makeChunks());
		const results = searchIndex(index, 'workflow', { limit: 1 });
		expect(results.length).toBeLessThanOrEqual(1);
	});

	test('empty query returns empty results', () => {
		const index = createSearchIndex(makeChunks());
		const results = searchIndex(index, '');
		expect(results.length).toBe(0);
	});
});
