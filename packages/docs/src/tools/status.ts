import { getSyncMetadata } from '../sync.ts';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir } from 'node:fs/promises';

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

function getStatusMetadataPath(): string {
	return join(homedir(), '.temporal-mcp', 'cache', 'docs-status.json');
}

async function loadDocsStatusMetadata(): Promise<DocsStatusMetadata | null> {
	try {
		const file = Bun.file(getStatusMetadataPath());
		if (!(await file.exists())) return null;
		return (await file.json()) as DocsStatusMetadata;
	} catch {
		return null;
	}
}

export async function persistDocsStatusMetadata(
	documentCount: number,
	sdkFilter: string[],
): Promise<void> {
	const metadata: DocsStatusMetadata = { documentCount, sdkFilter };
	await mkdir(join(homedir(), '.temporal-mcp', 'cache'), { recursive: true });
	await Bun.write(getStatusMetadataPath(), JSON.stringify(metadata, null, 2));
}

export async function getDocsStatus(
	documentCount?: number,
	sdkFilter?: string[],
): Promise<DocsStatus> {
	const meta = await getSyncMetadata();
	const persistedMetadata =
		documentCount === undefined || sdkFilter === undefined
			? await loadDocsStatusMetadata()
			: null;

	return {
		synced: meta !== null,
		commitSha: meta?.commitSha ?? null,
		lastSyncTime: meta?.lastSyncTime ?? null,
		documentCount: documentCount ?? persistedMetadata?.documentCount ?? 0,
		sdkFilter: sdkFilter ?? persistedMetadata?.sdkFilter ?? [],
	};
}
