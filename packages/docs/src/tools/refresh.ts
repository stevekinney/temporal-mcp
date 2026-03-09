import { syncDocs } from '../sync.ts';
import { getDocsStatus } from './status.ts';
import type { DocsStatus } from './status.ts';

export async function refreshDocs(): Promise<DocsStatus> {
	await syncDocs();
	return getDocsStatus();
}
