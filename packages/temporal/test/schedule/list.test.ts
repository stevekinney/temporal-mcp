import { describe, expect, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { listSchedules } from '../../src/tools/schedule/list.ts';

interface MockSchedule {
	scheduleId: string;
	memo?: Record<string, unknown>;
	state: { paused: boolean; note?: string };
}

function createMockClient(schedules: MockSchedule[]) {
	return {
		schedule: {
			list: () =>
				(async function* () {
					for (const schedule of schedules) yield schedule;
				})(),
		},
	} as unknown as Client;
}

describe('listSchedules', () => {
	test('returns empty array when no schedules exist', async () => {
		const client = createMockClient([]);
		const result = await listSchedules(client, {});
		expect(result).toEqual([]);
	});

	test('returns schedule summaries', async () => {
		const schedules: MockSchedule[] = [
			{ scheduleId: 'sched-1', memo: { key: 'value' }, state: { paused: false, note: 'active' } },
			{ scheduleId: 'sched-2', state: { paused: true, note: 'paused for maintenance' } },
		];
		const client = createMockClient(schedules);
		const result = await listSchedules(client, {});

		expect(result).toHaveLength(2);
		expect(result[0]!.scheduleId).toBe('sched-1');
		expect(result[0]!.memo).toEqual({ key: 'value' });
		expect(result[0]!.paused).toBe(false);
		expect(result[0]!.note).toBe('active');
		expect(result[1]!.scheduleId).toBe('sched-2');
		expect(result[1]!.paused).toBe(true);
	});

	test('respects pageSize limit', async () => {
		const schedules = Array.from({ length: 5 }, (_, i) => ({
			scheduleId: `sched-${i}`,
			state: { paused: false },
		}));
		const client = createMockClient(schedules);
		const result = await listSchedules(client, { pageSize: 3 });
		expect(result).toHaveLength(3);
	});

	test('defaults pageSize to 10', async () => {
		const schedules = Array.from({ length: 15 }, (_, i) => ({
			scheduleId: `sched-${i}`,
			state: { paused: false },
		}));
		const client = createMockClient(schedules);
		const result = await listSchedules(client, {});
		expect(result).toHaveLength(10);
	});

	test('defaults memo to empty object when undefined', async () => {
		const client = createMockClient([{ scheduleId: 'sched-1', state: { paused: false } }]);
		const result = await listSchedules(client, {});
		expect(result[0]!.memo).toEqual({});
	});

	test('defaults note to null when undefined', async () => {
		const client = createMockClient([{ scheduleId: 'sched-1', state: { paused: false } }]);
		const result = await listSchedules(client, {});
		expect(result[0]!.note).toBeNull();
	});
});
