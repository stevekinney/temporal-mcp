import type { Client } from '@temporalio/client';
import { listNamespaces as grpcListNamespaces } from '../../grpc.ts';
import type { NamespaceListResult } from '../../grpc.ts';

export interface NamespaceListInput {
	pageSize?: number;
}

export async function listNamespacesTool(client: Client, input: NamespaceListInput): Promise<NamespaceListResult> {
	return grpcListNamespaces(client, input);
}
