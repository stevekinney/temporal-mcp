import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	getDocsStatus,
	persistDocsStatusMetadata,
} from '../../src/tools/status.ts';

describe('docs status metadata', () => {
	test('defaults to zero counts when no persisted metadata exists', async () => {
		const temporaryHomeDirectory = await mkdtemp(
			join(tmpdir(), 'temporal-mcp-docs-status-'),
		);
		try {
			const status = await getDocsStatus(
				undefined,
				undefined,
				temporaryHomeDirectory,
			);
			expect(status.documentCount).toBe(0);
			expect(status.sdkFilter).toEqual([]);
		} finally {
			await rm(temporaryHomeDirectory, {
				recursive: true,
				force: true,
			});
		}
	});

	test('loads persisted metadata for document count and sdk filter', async () => {
		const temporaryHomeDirectory = await mkdtemp(
			join(tmpdir(), 'temporal-mcp-docs-status-'),
		);
		try {
			await persistDocsStatusMetadata(
				27,
				['typescript', 'go'],
				temporaryHomeDirectory,
			);
			const status = await getDocsStatus(
				undefined,
				undefined,
				temporaryHomeDirectory,
			);
			expect(status.documentCount).toBe(27);
			expect(status.sdkFilter).toEqual(['typescript', 'go']);
		} finally {
			await rm(temporaryHomeDirectory, {
				recursive: true,
				force: true,
			});
		}
	});

	test('explicit counts override persisted metadata', async () => {
		const temporaryHomeDirectory = await mkdtemp(
			join(tmpdir(), 'temporal-mcp-docs-status-'),
		);
		try {
			await persistDocsStatusMetadata(
				27,
				['typescript', 'go'],
				temporaryHomeDirectory,
			);
			const status = await getDocsStatus(
				3,
				['python'],
				temporaryHomeDirectory,
			);
			expect(status.documentCount).toBe(3);
			expect(status.sdkFilter).toEqual(['python']);
		} finally {
			await rm(temporaryHomeDirectory, {
				recursive: true,
				force: true,
			});
		}
	});
});
