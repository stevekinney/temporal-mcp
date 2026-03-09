import type { Client } from '@temporalio/client';

export interface ScheduleDescribeInput {
	scheduleId: string;
}

export async function describeSchedule(client: Client, input: ScheduleDescribeInput): Promise<unknown> {
	const handle = client.schedule.getHandle(input.scheduleId);
	const description = await handle.describe();
	return {
		scheduleId: description.scheduleId,
		schedule: description.spec,
		info: description.info,
		memo: description.memo ?? {},
		searchAttributes: description.searchAttributes ?? {},
	};
}
