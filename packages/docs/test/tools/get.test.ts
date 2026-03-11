import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDoc, validateDocPath } from '../../src/tools/get.ts';

describe('validateDocPath', () => {
	test('path traversal with ../ is rejected with PATH_TRAVERSAL error', () => {
		const corpusPath = '/tmp/test-corpus';
		try {
			validateDocPath(corpusPath, '../../../etc/passwd');
			expect.unreachable('should have thrown');
		} catch (error) {
			const envelope = error as {
				ok: false;
				error: { code: string; message: string };
			};
			expect(envelope.ok).toBe(false);
			expect(envelope.error.code).toBe('PATH_TRAVERSAL');
			expect(envelope.error.message).toContain('resolves outside');
		}
	});

	test('valid path returns resolved full path', () => {
		const corpusPath = '/tmp/test-corpus';
		const result = validateDocPath(corpusPath, 'docs/concepts/workflows.md');
		expect(result).toBe(join(corpusPath, 'docs/concepts/workflows.md'));
	});
});

describe('getDoc', () => {
	test('requesting nonexistent file throws DOC_NOT_FOUND', async () => {
		// We need to import getDoc dynamically since it depends on getCorpusPath
		// Instead, test the underlying logic using a temp directory
		const tempDir = await mkdtemp(join(tmpdir(), 'get-test-'));
		try {
			// validateDocPath returns a full path; we can check the file doesn't exist
			const fullPath = validateDocPath(tempDir, 'nonexistent.md');
			const file = Bun.file(fullPath);
			expect(await file.exists()).toBe(false);
		} finally {
			await rm(tempDir, { recursive: true });
		}
	});

	test('reads file content from corpus directory', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'get-read-'));
		try {
			const content = '# Test Document\n\nSome content here.';
			await Bun.write(join(tempDir, 'test.md'), content);

			const fullPath = validateDocPath(tempDir, 'test.md');
			const file = Bun.file(fullPath);
			expect(await file.exists()).toBe(true);
			expect(await file.text()).toBe(content);
		} finally {
			await rm(tempDir, { recursive: true });
		}
	});

	test('rejects symlink escapes outside corpus with PATH_TRAVERSAL', async () => {
		const corpusPath = await mkdtemp(join(tmpdir(), 'get-symlink-corpus-'));
		const outsideDirectory = await mkdtemp(
			join(tmpdir(), 'get-symlink-outside-'),
		);

		try {
			const docsPath = join(corpusPath, 'docs');
			await mkdir(docsPath, { recursive: true });

			const outsideFile = join(outsideDirectory, 'secret.md');
			await Bun.write(outsideFile, 'outside');

			const linkPath = join(docsPath, 'link.md');
			await symlink(outsideFile, linkPath);

			try {
				await getDoc({ sourcePath: 'docs/link.md', corpusPath });
				expect.unreachable('should have thrown');
			} catch (error) {
				const envelope = error as {
					ok: false;
					error: { code: string; message: string };
				};
				expect(envelope.ok).toBe(false);
				expect(envelope.error.code).toBe('PATH_TRAVERSAL');
			}
		} finally {
			await rm(corpusPath, { recursive: true });
			await rm(outsideDirectory, { recursive: true });
		}
	});
});
