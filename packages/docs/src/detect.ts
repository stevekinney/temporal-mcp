import { join } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';

export type SdkSlug =
	| 'typescript'
	| 'python'
	| 'go'
	| 'java'
	| 'dotnet'
	| 'php'
	| 'ruby';

export interface DetectionResult {
	detectedSdks: SdkSlug[];
	source: 'explicit' | 'scan' | 'fallback';
}

interface PackageManifest {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

async function readTextIfExists(path: string): Promise<string | null> {
	try {
		return await readFile(path, 'utf8');
	} catch {
		return null;
	}
}

async function hasTemporalDotnetProject(root: string): Promise<boolean> {
	const pendingDirectories = [root];

	while (pendingDirectories.length > 0) {
		const directoryPath = pendingDirectories.pop()!;
		let entries;
		try {
			entries = await readdir(directoryPath, { withFileTypes: true });
		} catch {
			continue;
		}

		for (const entry of entries) {
			const fullPath = join(directoryPath, entry.name);
			if (entry.isDirectory()) {
				pendingDirectories.push(fullPath);
				continue;
			}

			if (!entry.isFile() || !entry.name.endsWith('.csproj')) continue;

			const content = await readTextIfExists(fullPath);
			if (content?.includes('Temporalio')) {
				return true;
			}
		}
	}

	return false;
}

export async function detectSdks(options?: {
	explicit?: SdkSlug[];
	scanRoots?: string[];
}): Promise<DetectionResult> {
	// 1. Explicit config takes priority
	if (options?.explicit && options.explicit.length > 0) {
		return { detectedSdks: options.explicit, source: 'explicit' };
	}

	// 2. Scan roots for SDK markers
	const roots = options?.scanRoots ?? [process.cwd()];
	const detected = new Set<SdkSlug>();

	for (const root of roots) {
		// TypeScript/Node: check package.json for @temporalio/*
		try {
			const packageJson = await readFile(join(root, 'package.json'), 'utf8');
			const packageManifest = JSON.parse(packageJson) as PackageManifest;
			const allDependencies = {
				...packageManifest.dependencies,
				...packageManifest.devDependencies,
			};
			if (
				Object.keys(allDependencies).some((dependencyName) =>
					dependencyName.startsWith('@temporalio/'),
				)
			) {
				detected.add('typescript');
			}
		} catch {}

		// Python: check requirements.txt or pyproject.toml for temporalio
		const requirementsText = await readTextIfExists(
			join(root, 'requirements.txt'),
		);
		if (requirementsText?.includes('temporalio')) {
			detected.add('python');
		}

		const pyprojectContent = await readTextIfExists(join(root, 'pyproject.toml'));
		if (pyprojectContent?.includes('temporalio')) {
			detected.add('python');
		}

		// Go: check go.mod for go.temporal.io
		const goModuleContent = await readTextIfExists(join(root, 'go.mod'));
		if (goModuleContent?.includes('go.temporal.io')) {
			detected.add('go');
		}

		// Java: check build.gradle or pom.xml for io.temporal
		const gradleContent = await readTextIfExists(join(root, 'build.gradle'));
		if (gradleContent?.includes('io.temporal')) {
			detected.add('java');
		}

		const pomContent = await readTextIfExists(join(root, 'pom.xml'));
		if (pomContent?.includes('io.temporal')) {
			detected.add('java');
		}

		// .NET: check *.csproj files for Temporalio
		if (await hasTemporalDotnetProject(root)) {
			detected.add('dotnet');
		}
	}

	if (detected.size > 0) {
		return { detectedSdks: [...detected], source: 'scan' };
	}

	// 3. Fallback: common SDKs
	return {
		detectedSdks: ['typescript', 'python', 'go', 'java'],
		source: 'fallback',
	};
}
