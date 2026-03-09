import type { Client } from '@temporalio/client';
import { listSearchAttributes as grpcListSearchAttributes } from '../../grpc.ts';
import type { SearchAttributeList } from '../../grpc.ts';

export interface SearchAttributesListInput {
	namespace: string;
}

export async function listSearchAttributesTool(
	client: Client,
	input: SearchAttributesListInput,
): Promise<SearchAttributeList> {
	return grpcListSearchAttributes(client, input);
}
