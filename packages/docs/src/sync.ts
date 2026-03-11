import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';

const TEMPORAL_DOCS_REPO = 'https://github.com/temporalio/documentation.git';

export interface SyncMetadata {
	lastSyncTime: string;
	commitSha: string;
	corpusPath: string;
}

export function getCorpusPath(homeDirectory: string = homedir()): string {
	return join(homeDirectory, '.temporal-mcp', 'docs-corpus');
}

export function getSyncMetaPath(homeDirectory: string = homedir()): string {
	return join(homeDirectory, '.temporal-mcp', 'sync-meta.json');
}

function createSyncError(message: string, retryable: boolean): {
	ok: false;
	error: { code: 'SYNC_FAILED'; message: string; retryable: boolean };
} {
	return {
		ok: false,
		error: {
			code: 'SYNC_FAILED',
			message,
			retryable,
		},
	};
}

function formatStderr(stderr: Uint8Array): string {
	const text = new TextDecoder().decode(stderr).trim();
	return text.length > 0 ? text : 'No stderr output available.';
}

function runGitCommand(args: string[]): {
	exitCode: number;
	stderr: Uint8Array;
	stdout: Uint8Array;
} {
	const result = spawnSync('git', args, { encoding: 'buffer' });
	return {
		exitCode: result.status ?? 1,
		stderr: result.stderr ?? new Uint8Array(),
		stdout: result.stdout ?? new Uint8Array(),
	};
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

export async function syncDocs(): Promise<SyncMetadata> {
	// Check if git is available
	const gitCheck = runGitCommand(['--version']);
	if (gitCheck.exitCode !== 0) {
		throw {
			ok: false,
			error: {
				code: 'GIT_UNAVAILABLE',
				message: 'Git is not installed or not in PATH',
				retryable: false,
			},
		};
	}

	const homeDirectory = homedir();
	const corpusPath = getCorpusPath(homeDirectory);
	await mkdir(join(homeDirectory, '.temporal-mcp'), { recursive: true });

	// Check if already cloned
	const exists = await fileExists(join(corpusPath, '.git', 'HEAD'));

	if (exists) {
		// Pull latest
		const pull = runGitCommand(['-C', corpusPath, 'pull', '--ff-only']);
		if (pull.exitCode !== 0) {
			// Try reset and pull
			const fetch = runGitCommand(['-C', corpusPath, 'fetch', 'origin']);
			if (fetch.exitCode !== 0) {
				throw createSyncError(
					`Failed to fetch docs repository after pull failed: ${formatStderr(fetch.stderr)}`,
					true,
				);
			}
			const reset = runGitCommand([
				'-C',
				corpusPath,
				'reset',
				'--hard',
				'origin/main',
			]);
			if (reset.exitCode !== 0) {
				throw createSyncError(
					`Failed to reset docs repository after pull failed: ${formatStderr(reset.stderr)}`,
					true,
				);
			}
		}
	} else {
		// Shallow clone for speed
		const clone = runGitCommand([
			'clone',
			'--depth',
			'1',
			TEMPORAL_DOCS_REPO,
			corpusPath,
		]);
		if (clone.exitCode !== 0) {
			throw createSyncError(
				`Failed to clone docs repository: ${formatStderr(clone.stderr)}`,
				true,
			);
		}
	}

	// Get current commit SHA
	const shaResult = runGitCommand(['-C', corpusPath, 'rev-parse', 'HEAD']);
	if (shaResult.exitCode !== 0) {
		throw createSyncError(
			`Failed to read docs repository commit SHA: ${formatStderr(shaResult.stderr)}`,
			true,
		);
	}
	const commitSha = new TextDecoder().decode(shaResult.stdout).trim();

	const metadata: SyncMetadata = {
		lastSyncTime: new Date().toISOString(),
		commitSha,
		corpusPath,
	};

	// Persist sync metadata
	await writeFile(
		getSyncMetaPath(homeDirectory),
		JSON.stringify(metadata, null, 2),
		'utf8',
	);

	return metadata;
}

export async function getSyncMetadata(
	homeDirectory: string = homedir(),
): Promise<SyncMetadata | null> {
	try {
		const content = await readFile(getSyncMetaPath(homeDirectory), 'utf8');
		return JSON.parse(content) as SyncMetadata;
	} catch {
		return null;
	}
}
