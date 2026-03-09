import type { Client } from '@temporalio/client';

export interface ScheduleListInput {
	pageSize?: number;
}

export interface ScheduleListSummary {
	scheduleId: string;
	memo: Record<string, unknown>;
	paused: boolean;
	note: string | null;
}

export async function listSchedules(client: Client, input: ScheduleListInput): Promise<ScheduleListSummary[]> {
	const results: ScheduleListSummary[] = [];
	const pageSize = input.pageSize ?? 10;

	for await (const schedule of client.schedule.list()) {
		results.push({
			scheduleId: schedule.scheduleId,
			memo: schedule.memo ?? {},
			paused: schedule.state.paused,
			note: schedule.state.note ?? null,
		});
		if (results.length >= pageSize) break;
	}

	return results;
}
