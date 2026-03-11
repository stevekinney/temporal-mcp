import { join } from 'node:path';
import { Glob } from 'bun';

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
			const pkg = await Bun.file(join(root, 'package.json')).json();
			const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
			if (Object.keys(allDeps).some((d) => d.startsWith('@temporalio/'))) {
				detected.add('typescript');
			}
		} catch {}

		// Python: check requirements.txt or pyproject.toml for temporalio
		try {
			const req = await Bun.file(join(root, 'requirements.txt')).text();
			if (req.includes('temporalio')) detected.add('python');
		} catch {}
		try {
			const pyproject = await Bun.file(join(root, 'pyproject.toml')).text();
			if (pyproject.includes('temporalio')) detected.add('python');
		} catch {}

		// Go: check go.mod for go.temporal.io
		try {
			const gomod = await Bun.file(join(root, 'go.mod')).text();
			if (gomod.includes('go.temporal.io')) detected.add('go');
		} catch {}

		// Java: check build.gradle or pom.xml for io.temporal
		try {
			const gradle = await Bun.file(join(root, 'build.gradle')).text();
			if (gradle.includes('io.temporal')) detected.add('java');
		} catch {}
		try {
			const pom = await Bun.file(join(root, 'pom.xml')).text();
			if (pom.includes('io.temporal')) detected.add('java');
		} catch {}

		// .NET: check *.csproj for Temporalio using Bun's Glob
		try {
			const glob = new Glob('**/*.csproj');
			for await (const path of glob.scan({ cwd: root, absolute: true })) {
				const content = await Bun.file(path).text();
				if (content.includes('Temporalio')) {
					detected.add('dotnet');
					break;
				}
			}
		} catch {}
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
