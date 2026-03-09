import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectSdks } from '../src/detect.ts';

describe('detectSdks', () => {
	test('returns explicit SDKs when provided', async () => {
		const result = await detectSdks({
			explicit: ['typescript', 'go'],
		});
		expect(result.detectedSdks).toEqual(['typescript', 'go']);
		expect(result.source).toBe('explicit');
	});

	test('returns fallback when no files found in empty directory', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'detect-test-'));
		try {
			const result = await detectSdks({ scanRoots: [tempDir] });
			expect(result.source).toBe('fallback');
			expect(result.detectedSdks).toEqual([
				'typescript',
				'python',
				'go',
				'java',
			]);
		} finally {
			await rm(tempDir, { recursive: true });
		}
	});

	test('detection source is explicit for explicit option', async () => {
		const result = await detectSdks({ explicit: ['python'] });
		expect(result.source).toBe('explicit');
	});

	test('detects typescript SDK from package.json', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'detect-ts-'));
		try {
			await Bun.write(
				join(tempDir, 'package.json'),
				JSON.stringify({
					dependencies: { '@temporalio/client': '^1.0.0' },
				}),
			);
			const result = await detectSdks({ scanRoots: [tempDir] });
			expect(result.source).toBe('scan');
			expect(result.detectedSdks).toContain('typescript');
		} finally {
			await rm(tempDir, { recursive: true });
		}
	});

	test('detects python SDK from requirements.txt', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'detect-py-'));
		try {
			await Bun.write(join(tempDir, 'requirements.txt'), 'temporalio>=1.0.0\n');
			const result = await detectSdks({ scanRoots: [tempDir] });
			expect(result.source).toBe('scan');
			expect(result.detectedSdks).toContain('python');
		} finally {
			await rm(tempDir, { recursive: true });
		}
	});

	test('detects go SDK from go.mod', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'detect-go-'));
		try {
			await Bun.write(
				join(tempDir, 'go.mod'),
				'module example.com/myapp\n\nrequire go.temporal.io/sdk v1.0.0\n',
			);
			const result = await detectSdks({ scanRoots: [tempDir] });
			expect(result.source).toBe('scan');
			expect(result.detectedSdks).toContain('go');
		} finally {
			await rm(tempDir, { recursive: true });
		}
	});
});
