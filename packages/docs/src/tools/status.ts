import { getSyncMetadata } from '../sync.ts';

export interface DocsStatus {
	synced: boolean;
	commitSha: string | null;
	lastSyncTime: string | null;
	documentCount: number;
	sdkFilter: string[];
}

export async function getDocsStatus(
	documentCount: number = 0,
	sdkFilter: string[] = [],
): Promise<DocsStatus> {
	const meta = await getSyncMetadata();
	return {
		synced: meta !== null,
		commitSha: meta?.commitSha ?? null,
		lastSyncTime: meta?.lastSyncTime ?? null,
		documentCount,
		sdkFilter,
	};
}
