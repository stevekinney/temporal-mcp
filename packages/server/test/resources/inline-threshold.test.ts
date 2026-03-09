import { describe, expect, test } from 'bun:test';
import { checkInlineThreshold } from '../../src/resources/inline-threshold.ts';

describe('checkInlineThreshold', () => {
	test('returns inline: true for small data', () => {
		const smallData = { key: 'value', count: 42 };
		const result = checkInlineThreshold(
			smallData,
			'temporal:///default/workflow/wf-1',
		);

		expect(result.inline).toBe(true);
		expect(result.summary).toBeUndefined();
		expect(result.resourceUri).toBeUndefined();
	});

	test('returns inline: false with summary for large data', () => {
		// Create data that exceeds 32KB
		const largeData: Record<string, string> = {};
		for (let i = 0; i < 1000; i++) {
			largeData[`key_${i}`] = 'x'.repeat(100);
		}

		const resourceUri = 'temporal:///default/workflow/wf-large';
		const result = checkInlineThreshold(largeData, resourceUri);

		expect(result.inline).toBe(false);
		expect(result.summary).toBeDefined();
		expect(result.summary).toContain('32KB');
		expect(result.summary).toContain(resourceUri);
		expect(result.resourceUri).toBe(resourceUri);
	});

	test('summary includes resource URI', () => {
		const largeData: Record<string, string> = {};
		for (let i = 0; i < 1000; i++) {
			largeData[`key_${i}`] = 'x'.repeat(100);
		}

		const uri = 'temporal:///prod/workflow/wf-very-large';
		const result = checkInlineThreshold(largeData, uri);

		expect(result.inline).toBe(false);
		expect(result.summary).toContain(uri);
	});

	test('summary includes key names for objects', () => {
		const largeData: Record<string, string> = {
			alpha: 'x'.repeat(10000),
			beta: 'x'.repeat(10000),
			gamma: 'x'.repeat(10000),
			delta: 'x'.repeat(10000),
		};

		const result = checkInlineThreshold(
			largeData,
			'temporal:///test/workflow/wf-1',
		);

		expect(result.inline).toBe(false);
		expect(result.summary).toContain('alpha');
		expect(result.summary).toContain('beta');
	});
});
