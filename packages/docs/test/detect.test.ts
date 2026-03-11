import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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
			await writeFile(
				join(tempDir, 'package.json'),
				JSON.stringify({
					dependencies: { '@temporalio/client': '^1.0.0' },
				}),
				'utf8',
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
			await writeFile(join(tempDir, 'requirements.txt'), 'temporalio>=1.0.0\n');
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
			await writeFile(
				join(tempDir, 'go.mod'),
				'module example.com/myapp\n\nrequire go.temporal.io/sdk v1.0.0\n',
				'utf8',
			);
			const result = await detectSdks({ scanRoots: [tempDir] });
			expect(result.source).toBe('scan');
			expect(result.detectedSdks).toContain('go');
		} finally {
			await rm(tempDir, { recursive: true });
		}
	});

	test('detects dotnet SDK from nested csproj files', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'detect-dotnet-'));
		try {
			const nestedPath = join(tempDir, 'services', 'api');
			await mkdir(nestedPath, { recursive: true });
			await writeFile(
				join(nestedPath, 'Example.csproj'),
				'<Project><ItemGroup><PackageReference Include="Temporalio" Version="1.0.0" /></ItemGroup></Project>',
				'utf8',
			);
			const result = await detectSdks({ scanRoots: [tempDir] });
			expect(result.source).toBe('scan');
			expect(result.detectedSdks).toContain('dotnet');
		} finally {
			await rm(tempDir, { recursive: true });
		}
	});

	test('ignores dotnet markers inside hidden directories', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'detect-dotnet-hidden-'));
		try {
			const hiddenPath = join(tempDir, '.hidden-service');
			await mkdir(hiddenPath, { recursive: true });
			await writeFile(
				join(hiddenPath, 'Hidden.csproj'),
				'<Project><ItemGroup><PackageReference Include="Temporalio" Version="1.0.0" /></ItemGroup></Project>',
				'utf8',
			);
			const result = await detectSdks({ scanRoots: [tempDir] });
			expect(result.detectedSdks).not.toContain('dotnet');
			expect(result.source).toBe('fallback');
		} finally {
			await rm(tempDir, { recursive: true });
		}
	});
});
