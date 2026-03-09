import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	getDocsStatus,
	persistDocsStatusMetadata,
} from '../../src/tools/status.ts';

describe('docs status metadata', () => {
	let temporaryHomeDirectory = '';
	let originalHome = '';
	let originalUserProfile = '';

	beforeEach(() => {
		temporaryHomeDirectory = mkdtempSync(
			join(tmpdir(), 'temporal-mcp-docs-status-'),
		);
		originalHome = process.env.HOME ?? '';
		originalUserProfile = process.env.USERPROFILE ?? '';
		process.env.HOME = temporaryHomeDirectory;
		delete process.env.USERPROFILE;
	});

	afterEach(async () => {
		process.env.HOME = originalHome;
		process.env.USERPROFILE = originalUserProfile;
		if (temporaryHomeDirectory) {
			await rm(temporaryHomeDirectory, {
				recursive: true,
				force: true,
			});
		}
	});

	test('defaults to zero counts when no persisted metadata exists', async () => {
		const status = await getDocsStatus();
		expect(status.documentCount).toBe(0);
		expect(status.sdkFilter).toEqual([]);
	});

	test('loads persisted metadata for document count and sdk filter', async () => {
		await persistDocsStatusMetadata(27, ['typescript', 'go']);
		const status = await getDocsStatus();
		expect(status.documentCount).toBe(27);
		expect(status.sdkFilter).toEqual(['typescript', 'go']);
	});

	test('explicit counts override persisted metadata', async () => {
		await persistDocsStatusMetadata(27, ['typescript', 'go']);
		const status = await getDocsStatus(3, ['python']);
		expect(status.documentCount).toBe(3);
		expect(status.sdkFilter).toEqual(['python']);
	});
});
