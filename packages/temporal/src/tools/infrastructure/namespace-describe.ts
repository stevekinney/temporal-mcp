import type { Client } from '@temporalio/client';
import { describeNamespace as grpcDescribeNamespace } from '../../grpc.ts';
import type { NamespaceDescription } from '../../grpc.ts';

export interface NamespaceDescribeInput {
	namespace: string;
}

export async function describeNamespaceTool(
	client: Client,
	input: NamespaceDescribeInput,
): Promise<NamespaceDescription> {
	return grpcDescribeNamespace(client, input);
}
