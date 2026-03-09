import type { Client } from '@temporalio/client';
import {
	listWorkerDeployments as grpcList,
	describeWorkerDeployment as grpcDescribe,
	describeWorkerDeploymentVersion as grpcDescribeVersion,
	getDeploymentReachability as grpcReachability,
} from '../../grpc.ts';
import type {
	WorkerDeploymentList,
	WorkerDeploymentDescription,
	WorkerDeploymentVersionDescription,
	DeploymentReachabilityInfo,
} from '../../grpc.ts';

export interface DeploymentListInput {
	namespace: string;
	pageSize?: number;
}

export async function listWorkerDeployments(
	client: Client,
	input: DeploymentListInput,
): Promise<WorkerDeploymentList> {
	return grpcList(client, input);
}

export interface DeploymentDescribeInput {
	namespace: string;
	deploymentName: string;
}

export async function describeWorkerDeployment(
	client: Client,
	input: DeploymentDescribeInput,
): Promise<WorkerDeploymentDescription> {
	return grpcDescribe(client, input);
}

export interface DeploymentVersionDescribeInput {
	namespace: string;
	deploymentName: string;
	buildId: string;
}

export async function describeWorkerDeploymentVersion(
	client: Client,
	input: DeploymentVersionDescribeInput,
): Promise<WorkerDeploymentVersionDescription> {
	return grpcDescribeVersion(client, input);
}

export interface DeploymentReachabilityInput {
	namespace: string;
	deploymentName: string;
}

export async function getDeploymentReachability(
	client: Client,
	input: DeploymentReachabilityInput,
): Promise<DeploymentReachabilityInfo> {
	return grpcReachability(client, input);
}
