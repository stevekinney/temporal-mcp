import { describe, expect, test } from 'bun:test';
import {
	stripFrontmatter,
	stripMdxComponents,
	stripAdmonitions,
	chunkDocument,
} from '../src/chunking.ts';

describe('stripFrontmatter', () => {
	test('removes YAML between --- markers', () => {
		const input = `---
title: Hello
sidebar_label: World
---
# Actual content`;
		const result = stripFrontmatter(input);
		expect(result).toBe('# Actual content');
	});

	test('returns content unchanged if no frontmatter', () => {
		const input = '# Just a heading\n\nSome text.';
		const result = stripFrontmatter(input);
		expect(result).toBe(input);
	});
});

describe('stripMdxComponents', () => {
	test('removes import statements', () => {
		const input = `import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Hello`;
		const result = stripMdxComponents(input);
		expect(result).not.toContain('import');
		expect(result).toContain('# Hello');
	});

	test('removes self-closing JSX components', () => {
		const input = 'Some text <MyComponent /> more text';
		const result = stripMdxComponents(input);
		expect(result).toBe('Some text  more text');
	});
});

describe('stripAdmonitions', () => {
	test('removes :::note blocks', () => {
		const input = `Some text

:::note
This is a note.
:::

More text`;
		const result = stripAdmonitions(input);
		expect(result).not.toContain(':::note');
		expect(result).not.toMatch(/^:::$/m);
		expect(result).toContain('This is a note.');
		expect(result).toContain('More text');
	});
});

describe('chunkDocument', () => {
	test('splits on h1-h3 headings', () => {
		const input = `# First heading

First content.

## Second heading

Second content.

### Third heading

Third content.`;
		const chunks = chunkDocument(input, 'docs/test.md');
		expect(chunks.length).toBe(3);
		expect(chunks[0]!.title).toBe('First heading');
		expect(chunks[0]!.text).toContain('First content.');
		expect(chunks[1]!.title).toBe('Second heading');
		expect(chunks[2]!.title).toBe('Third heading');
	});

	test('preserves heading path', () => {
		const input = `# Top

Content.

## Sub

Sub content.

### Deep

Deep content.`;
		const chunks = chunkDocument(input, 'docs/test.md');
		// The chunk for "Sub" should have headingPath containing "Top" > "Sub"
		const subChunk = chunks.find((c) => c.title === 'Sub');
		expect(subChunk).toBeDefined();
		// After "## Sub", headingPath should include [Top, Sub]
		// The text of subChunk is captured between ## Sub and ### Deep
		expect(subChunk!.headingPath).toContain('Sub');

		const deepChunk = chunks.find((c) => c.title === 'Deep');
		expect(deepChunk).toBeDefined();
		expect(deepChunk!.headingPath).toContain('Deep');
	});

	test('returns single chunk for document with no headings', () => {
		const input = 'Just some plain text without any headings.';
		const chunks = chunkDocument(input, 'docs/plain.md');
		expect(chunks.length).toBe(1);
		expect(chunks[0]!.text).toBe(input);
	});

	test('sets sourcePath on all chunks', () => {
		const input = `# One

Text.

## Two

Text.`;
		const path = 'docs/concepts/workflows.md';
		const chunks = chunkDocument(input, path);
		for (const chunk of chunks) {
			expect(chunk.sourcePath).toBe(path);
		}
	});

	test('extracts section from path', () => {
		const input = '# Hello\n\nWorld.';
		const chunks = chunkDocument(input, 'docs/concepts/workflows.md');
		expect(chunks[0]!.section).toBe('concepts');

		const devChunks = chunkDocument(input, 'docs/develop/sdk.md');
		expect(devChunks[0]!.section).toBe('develop');

		const noSection = chunkDocument(input, 'docs/other/thing.md');
		expect(noSection[0]!.section).toBeNull();
	});
});
