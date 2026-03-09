import { describe, expect, mock, test } from 'bun:test';
import type { Client } from '@temporalio/client';
import { listScheduleMatchingTimes } from '../../src/tools/schedule/matching-times.ts';

function createMockClient(response: Record<string, unknown> = {}) {
	const grpcFn = mock(() => Promise.resolve(response));
	return {
		client: {
			workflowService: {
				listScheduleMatchingTimes: grpcFn,
			},
		} as unknown as Client,
		grpcFn,
	};
}

describe('listScheduleMatchingTimes', () => {
	test('delegates to grpc function and returns result', async () => {
		const { client } = createMockClient({
			startTime: [{ seconds: 1700000000 }, { seconds: 1700003600 }],
		});

		const result = await listScheduleMatchingTimes(client, {
			namespace: 'default',
			scheduleId: 'sched-1',
			startTime: '2026-01-01T00:00:00Z',
			endTime: '2026-01-02T00:00:00Z',
		});

		expect(result.startTimes).toHaveLength(2);
		expect(result.startTimes[0]).toBeTypeOf('string');
	});

	test('passes correct parameters through to grpc', async () => {
		const { client, grpcFn } = createMockClient({ startTime: [] });

		await listScheduleMatchingTimes(client, {
			namespace: 'production',
			scheduleId: 'sched-2',
			startTime: '2026-03-01T00:00:00Z',
			endTime: '2026-03-02T00:00:00Z',
		});

		expect(grpcFn).toHaveBeenCalledWith({
			namespace: 'production',
			scheduleId: 'sched-2',
			startTime: {
				seconds: Math.floor(new Date('2026-03-01T00:00:00Z').getTime() / 1000),
			},
			endTime: {
				seconds: Math.floor(new Date('2026-03-02T00:00:00Z').getTime() / 1000),
			},
		});
	});

	test('handles empty matching times', async () => {
		const { client } = createMockClient({ startTime: [] });

		const result = await listScheduleMatchingTimes(client, {
			namespace: 'default',
			scheduleId: 'sched-1',
			startTime: '2026-01-01T00:00:00Z',
			endTime: '2026-01-02T00:00:00Z',
		});

		expect(result.startTimes).toEqual([]);
	});
});
