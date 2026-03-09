import { describe, expect, test } from 'bun:test';
import {
	listCloudNamespaces,
	describeCloudNamespace,
	getCloudAccountInfo,
} from '../src/cloud.ts';

describe('cloud stubs', () => {
	test('listCloudNamespaces returns CLOUD_API_UNAVAILABLE error', () => {
		const result = listCloudNamespaces();
		expect(result.ok).toBe(false);
		expect(result.error.code).toBe('CLOUD_API_UNAVAILABLE');
		expect(result.error.message).toContain('listCloudNamespaces');
		expect(result.error.retryable).toBe(false);
	});

	test('describeCloudNamespace returns CLOUD_API_UNAVAILABLE error', () => {
		const result = describeCloudNamespace();
		expect(result.ok).toBe(false);
		expect(result.error.code).toBe('CLOUD_API_UNAVAILABLE');
		expect(result.error.message).toContain('describeCloudNamespace');
		expect(result.error.retryable).toBe(false);
	});

	test('getCloudAccountInfo returns CLOUD_API_UNAVAILABLE error', () => {
		const result = getCloudAccountInfo();
		expect(result.ok).toBe(false);
		expect(result.error.code).toBe('CLOUD_API_UNAVAILABLE');
		expect(result.error.message).toContain('getCloudAccountInfo');
		expect(result.error.retryable).toBe(false);
	});

	test('error messages indicate future availability', () => {
		const result = listCloudNamespaces();
		expect(result.error.message).toContain('not yet implemented');
		expect(result.error.message).toContain('future release');
	});
});
