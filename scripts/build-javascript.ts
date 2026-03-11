import { chmod, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

interface BuildTarget {
	label: string;
	entrypoint: string;
	outputDirectory: string;
	outputFileName: string;
	executable: boolean;
}

const buildTargets: BuildTarget[] = [
	{
		label: 'cli',
		entrypoint: 'src/index.ts',
		outputDirectory: 'dist',
		outputFileName: 'cli.js',
		executable: true,
	},
	{
		label: '@temporal-mcp/server',
		entrypoint: 'packages/server/src/index.ts',
		outputDirectory: 'packages/server/dist',
		outputFileName: 'index.js',
		executable: false,
	},
	{
		label: '@temporal-mcp/temporal',
		entrypoint: 'packages/temporal/src/index.ts',
		outputDirectory: 'packages/temporal/dist',
		outputFileName: 'index.js',
		executable: false,
	},
	{
		label: '@temporal-mcp/docs',
		entrypoint: 'packages/docs/src/index.ts',
		outputDirectory: 'packages/docs/dist',
		outputFileName: 'index.js',
		executable: false,
	},
];

function printBuildLog(log: {
	level: string;
	message: string;
	position?: {
		file: string;
		line: number;
		column: number;
	} | null;
}): void {
	if ('position' in log && log.position) {
		console.error(
			`${log.level}: ${log.message} (${log.position.file}:${log.position.line}:${log.position.column})`,
		);
		return;
	}

	console.error(`${log.level}: ${log.message}`);
}

async function buildTarget(target: BuildTarget): Promise<void> {
	const result = await Bun.build({
		entrypoints: [target.entrypoint],
		outdir: target.outputDirectory,
		format: 'esm',
		target: 'node',
		packages: 'external',
		sourcemap: 'none',
		minify: false,
		banner: target.executable ? '#!/usr/bin/env node' : undefined,
	});

	if (!result.success) {
		for (const log of result.logs) {
			printBuildLog(log);
		}
		throw new Error(`Failed building ${target.label}`);
	}

	const outputPath = result.outputs[0]?.path;
	if (!outputPath) {
		throw new Error(`No output generated for ${target.label}`);
	}

	const expectedOutputPath = resolve(target.outputDirectory, target.outputFileName);
	const actualOutputPath = resolve(outputPath);
	if (actualOutputPath !== expectedOutputPath) {
		await mkdir(dirname(expectedOutputPath), { recursive: true });
		await rm(expectedOutputPath, { force: true });
		await rename(actualOutputPath, expectedOutputPath);
	}

	if (target.executable) {
		await chmod(expectedOutputPath, 0o755);
	}
}

for (const target of buildTargets) {
	console.error(`[build] ${target.label}`);
	await buildTarget(target);
}
