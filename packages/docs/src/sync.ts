import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir } from 'node:fs/promises';

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
	const text = stderr.toString().trim();
	return text.length > 0 ? text : 'No stderr output available.';
}

export async function syncDocs(): Promise<SyncMetadata> {
	// Check if git is available
	const gitCheck = Bun.spawnSync(['git', '--version']);
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
	const exists = await Bun.file(join(corpusPath, '.git', 'HEAD')).exists();

	if (exists) {
		// Pull latest
		const pull = Bun.spawnSync(['git', '-C', corpusPath, 'pull', '--ff-only']);
		if (pull.exitCode !== 0) {
			// Try reset and pull
			const fetch = Bun.spawnSync(['git', '-C', corpusPath, 'fetch', 'origin']);
			if (fetch.exitCode !== 0) {
				throw createSyncError(
					`Failed to fetch docs repository after pull failed: ${formatStderr(fetch.stderr)}`,
					true,
				);
			}
			const reset = Bun.spawnSync([
				'git',
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
		const clone = Bun.spawnSync([
			'git',
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
	const shaResult = Bun.spawnSync([
		'git',
		'-C',
		corpusPath,
		'rev-parse',
		'HEAD',
	]);
	if (shaResult.exitCode !== 0) {
		throw createSyncError(
			`Failed to read docs repository commit SHA: ${formatStderr(shaResult.stderr)}`,
			true,
		);
	}
	const commitSha = shaResult.stdout.toString().trim();

	const metadata: SyncMetadata = {
		lastSyncTime: new Date().toISOString(),
		commitSha,
		corpusPath,
	};

	// Persist sync metadata
	await Bun.write(
		getSyncMetaPath(homeDirectory),
		JSON.stringify(metadata, null, 2),
	);

	return metadata;
}

export async function getSyncMetadata(
	homeDirectory: string = homedir(),
): Promise<SyncMetadata | null> {
	try {
		const file = Bun.file(getSyncMetaPath(homeDirectory));
		if (!(await file.exists())) return null;
		return await file.json();
	} catch {
		return null;
	}
}
