import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dir, '..', '..', '..', '..');
const runtimeSourceDirectories = [
	join(repositoryRoot, 'src'),
	join(repositoryRoot, 'packages', 'server', 'src'),
	join(repositoryRoot, 'packages', 'temporal', 'src'),
	join(repositoryRoot, 'packages', 'docs', 'src'),
];

async function collectTypescriptFiles(
	directoryPath: string,
): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(directoryPath, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(directoryPath, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectTypescriptFiles(fullPath)));
			continue;
		}

		if (entry.isFile() && fullPath.endsWith('.ts')) {
			files.push(fullPath);
		}
	}

	return files;
}

describe('runtime source compatibility', () => {
	test('does not use Bun-specific runtime APIs in production source', async () => {
		const sourceFiles = (
			await Promise.all(runtimeSourceDirectories.map(collectTypescriptFiles))
		).flat();
		const violations: string[] = [];

		for (const sourceFile of sourceFiles) {
			const content = await readFile(sourceFile, 'utf8');
			if (/\bBun\./.test(content) || /from\s+['"]bun['"]/.test(content)) {
				violations.push(relative(repositoryRoot, sourceFile));
			}
		}

		expect(violations).toEqual([]);
	});
});
