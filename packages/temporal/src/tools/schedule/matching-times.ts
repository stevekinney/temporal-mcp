import type { Client } from '@temporalio/client';
import { listScheduleMatchingTimes as grpcListMatchingTimes } from '../../grpc.ts';
import type { ScheduleMatchingTimes } from '../../grpc.ts';

export interface ScheduleMatchingTimesInput {
	namespace: string;
	scheduleId: string;
	startTime: string;
	endTime: string;
}

export async function listScheduleMatchingTimes(
	client: Client,
	input: ScheduleMatchingTimesInput,
): Promise<ScheduleMatchingTimes> {
	return grpcListMatchingTimes(client, {
		namespace: input.namespace,
		scheduleId: input.scheduleId,
		startTime: input.startTime,
		endTime: input.endTime,
	});
}
