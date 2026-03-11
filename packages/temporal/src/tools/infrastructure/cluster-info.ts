import type { Client } from '@temporalio/client';
import { getSystemInfo } from '../../grpc.ts';
import type { SystemInfo } from '../../grpc.ts';

export async function getClusterInfo(client: Client): Promise<SystemInfo> {
	return getSystemInfo(client);
}
