import type { TemporalConnectionManager } from '../connection.ts';
import type { SystemInfo } from '../grpc.ts';
import { getSystemInfo } from '../grpc.ts';

export interface ConnectionCheckResult {
	connected: boolean;
	profile: string;
	serverInfo: SystemInfo | null;
	error: string | null;
}

export async function checkConnection(
	connectionManager: TemporalConnectionManager,
	profileName?: string,
): Promise<ConnectionCheckResult> {
	const profile = profileName ?? 'default';
	try {
		const client = await connectionManager.getClient(profileName);
		const info = await getSystemInfo(client);
		return { connected: true, profile, serverInfo: info, error: null };
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: typeof error === 'object' && error !== null && 'error' in error
					? (error as any).error.message
					: 'Unknown error';
		return { connected: false, profile, serverInfo: null, error: message };
	}
}
