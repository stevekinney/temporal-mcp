import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir } from 'node:fs/promises';

const TEMPORAL_DOCS_REPO = 'https://github.com/temporalio/documentation.git';

export interface SyncMetadata {
	lastSyncTime: string;
	commitSha: string;
	corpusPath: string;
}

export function getCorpusPath(): string {
	return join(homedir(), '.temporal-mcp', 'docs-corpus');
}

export function getSyncMetaPath(): string {
	return join(homedir(), '.temporal-mcp', 'sync-meta.json');
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

	const corpusPath = getCorpusPath();
	await mkdir(join(homedir(), '.temporal-mcp'), { recursive: true });

	// Check if already cloned
	const exists = await Bun.file(join(corpusPath, '.git', 'HEAD')).exists();

	if (exists) {
		// Pull latest
		const pull = Bun.spawnSync(['git', '-C', corpusPath, 'pull', '--ff-only']);
		if (pull.exitCode !== 0) {
			// Try reset and pull
			Bun.spawnSync(['git', '-C', corpusPath, 'fetch', 'origin']);
			Bun.spawnSync([
				'git',
				'-C',
				corpusPath,
				'reset',
				'--hard',
				'origin/main',
			]);
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
			throw {
				ok: false,
				error: {
					code: 'SYNC_FAILED',
					message: `Failed to clone docs repository: ${clone.stderr.toString()}`,
					retryable: true,
				},
			};
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
	const commitSha = shaResult.stdout.toString().trim();

	const metadata: SyncMetadata = {
		lastSyncTime: new Date().toISOString(),
		commitSha,
		corpusPath,
	};

	// Persist sync metadata
	await Bun.write(getSyncMetaPath(), JSON.stringify(metadata, null, 2));

	return metadata;
}

export async function getSyncMetadata(): Promise<SyncMetadata | null> {
	try {
		const file = Bun.file(getSyncMetaPath());
		if (!(await file.exists())) return null;
		return await file.json();
	} catch {
		return null;
	}
}
