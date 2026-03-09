import { describe, expect, test } from 'bun:test';
import { redactSensitiveFields } from '../../src/safety/redaction.ts';

describe('redactSensitiveFields', () => {
	test('redacts keys matching default patterns', () => {
		const input = {
			name: 'test',
			apiKey: 'secret-123',
			password: 'hunter2',
			token: 'jwt-abc',
			secret: 'shhh',
			credential: 'cred-xyz',
			authorization: 'Bearer abc',
			cookie: 'session=abc',
			sessionId: 'sess-123',
		};

		const result = redactSensitiveFields(input) as Record<
			string,
			unknown
		>;
		expect(result.name).toBe('test');
		expect(result.apiKey).toBe('[REDACTED]');
		expect(result.password).toBe('[REDACTED]');
		expect(result.token).toBe('[REDACTED]');
		expect(result.secret).toBe('[REDACTED]');
		expect(result.credential).toBe('[REDACTED]');
		expect(result.authorization).toBe('[REDACTED]');
		expect(result.cookie).toBe('[REDACTED]');
		expect(result.sessionId).toBe('[REDACTED]');
	});

	test('handles nested objects', () => {
		const input = {
			user: {
				name: 'Alice',
				apiKey: 'secret-key',
				profile: {
					email: 'alice@example.com',
					authToken: 'tok-123',
				},
			},
		};

		const result = redactSensitiveFields(input) as any;
		expect(result.user.name).toBe('Alice');
		expect(result.user.apiKey).toBe('[REDACTED]');
		expect(result.user.profile.email).toBe('alice@example.com');
		expect(result.user.profile.authToken).toBe('[REDACTED]');
	});

	test('handles arrays', () => {
		const input = [
			{ name: 'item1', apiKey: 'key1' },
			{ name: 'item2', password: 'pass2' },
		];

		const result = redactSensitiveFields(input) as any[];
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe('item1');
		expect(result[0].apiKey).toBe('[REDACTED]');
		expect(result[1].name).toBe('item2');
		expect(result[1].password).toBe('[REDACTED]');
	});

	test('passes through primitives unchanged', () => {
		expect(redactSensitiveFields('hello')).toBe('hello');
		expect(redactSensitiveFields(42)).toBe(42);
		expect(redactSensitiveFields(true)).toBe(true);
	});

	test('handles null and undefined', () => {
		expect(redactSensitiveFields(null)).toBeNull();
		expect(redactSensitiveFields(undefined)).toBeUndefined();
	});

	test('custom patterns work', () => {
		const input = {
			name: 'test',
			customField: 'should-redact',
			normalField: 'should-keep',
		};

		const result = redactSensitiveFields(input, [
			'customField',
		]) as Record<string, unknown>;
		expect(result.name).toBe('test');
		expect(result.customField).toBe('[REDACTED]');
		expect(result.normalField).toBe('should-keep');
	});

	test('pattern matching is case-insensitive', () => {
		const input = {
			APIKEY: 'key1',
			ApiKey: 'key2',
			apikey: 'key3',
		};

		const result = redactSensitiveFields(input) as Record<
			string,
			unknown
		>;
		expect(result.APIKEY).toBe('[REDACTED]');
		expect(result.ApiKey).toBe('[REDACTED]');
		expect(result.apikey).toBe('[REDACTED]');
	});
});
