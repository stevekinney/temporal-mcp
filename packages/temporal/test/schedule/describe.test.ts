import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { describeSchedule } from '../../src/tools/schedule/describe.ts';

function createMockClient(description: Record<string, unknown>) {
	const describeFn = mock(() => Promise.resolve(description));
	const getHandle = mock((_scheduleId: string) => ({
		describe: describeFn,
	}));
	const client = {
		schedule: { getHandle },
	} as unknown as Client;
	return { client, getHandle, describeFn };
}

describe('describeSchedule', () => {
	test('returns schedule description', async () => {
		const { client } = createMockClient({
			scheduleId: 'sched-1',
			spec: { intervals: [{ every: 3600000 }] },
			info: { nextActionTimes: [] },
			memo: { key: 'value' },
			searchAttributes: { attr: 'val' },
		});
		const result = (await describeSchedule(client, { scheduleId: 'sched-1' })) as any;

		expect(result.scheduleId).toBe('sched-1');
		expect(result.schedule).toEqual({ intervals: [{ every: 3600000 }] });
		expect(result.memo).toEqual({ key: 'value' });
		expect(result.searchAttributes).toEqual({ attr: 'val' });
	});

	test('passes scheduleId to getHandle', async () => {
		const { client, getHandle } = createMockClient({
			scheduleId: 'sched-1',
			spec: {},
			info: {},
		});
		await describeSchedule(client, { scheduleId: 'sched-1' });
		expect(getHandle).toHaveBeenCalledWith('sched-1');
	});

	test('defaults memo to empty object when undefined', async () => {
		const { client } = createMockClient({
			scheduleId: 'sched-1',
			spec: {},
			info: {},
			memo: undefined,
		});
		const result = (await describeSchedule(client, { scheduleId: 'sched-1' })) as any;
		expect(result.memo).toEqual({});
	});

	test('defaults searchAttributes to empty object when undefined', async () => {
		const { client } = createMockClient({
			scheduleId: 'sched-1',
			spec: {},
			info: {},
			searchAttributes: undefined,
		});
		const result = (await describeSchedule(client, { scheduleId: 'sched-1' })) as any;
		expect(result.searchAttributes).toEqual({});
	});
});
