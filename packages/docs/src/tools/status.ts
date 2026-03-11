import { getSyncMetadata } from '../sync.ts';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export interface DocsStatus {
	synced: boolean;
	commitSha: string | null;
	lastSyncTime: string | null;
	documentCount: number;
	sdkFilter: string[];
}

interface DocsStatusMetadata {
	documentCount: number;
	sdkFilter: string[];
}

function getStatusMetadataPath(homeDirectory: string = homedir()): string {
	return join(homeDirectory, '.temporal-mcp', 'cache', 'docs-status.json');
}

async function loadDocsStatusMetadata(
	homeDirectory: string = homedir(),
): Promise<DocsStatusMetadata | null> {
	try {
		const content = await readFile(getStatusMetadataPath(homeDirectory), 'utf8');
		return JSON.parse(content) as DocsStatusMetadata;
	} catch {
		return null;
	}
}

export async function persistDocsStatusMetadata(
	documentCount: number,
	sdkFilter: string[],
	homeDirectory: string = homedir(),
): Promise<void> {
	const metadata: DocsStatusMetadata = { documentCount, sdkFilter };
	await mkdir(join(homeDirectory, '.temporal-mcp', 'cache'), {
		recursive: true,
	});
	await writeFile(
		getStatusMetadataPath(homeDirectory),
		JSON.stringify(metadata, null, 2),
		'utf8',
	);
}

export async function getDocsStatus(
	documentCount?: number,
	sdkFilter?: string[],
	homeDirectory: string = homedir(),
): Promise<DocsStatus> {
	const meta = await getSyncMetadata(homeDirectory);
	const persistedMetadata =
		documentCount === undefined || sdkFilter === undefined
			? await loadDocsStatusMetadata(homeDirectory)
			: null;

	return {
		synced: meta !== null,
		commitSha: meta?.commitSha ?? null,
		lastSyncTime: meta?.lastSyncTime ?? null,
		documentCount: documentCount ?? persistedMetadata?.documentCount ?? 0,
		sdkFilter: sdkFilter ?? persistedMetadata?.sdkFilter ?? [],
	};
}
