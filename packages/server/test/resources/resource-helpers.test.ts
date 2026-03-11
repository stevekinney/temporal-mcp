import { describe, expect, test } from 'bun:test';
import { DEFAULT_APP_CONFIG } from '../../src/config/schema.ts';
import {
	assertResourcePolicy,
	jsonResourceContent,
} from '../../src/resources/resource-helpers.ts';
import type { ResourceRegistrationContext } from '../../src/resources/register.ts';
import { AuditLogger } from '../../src/safety/audit-log.ts';

function makeContext(
	overrides: Partial<ResourceRegistrationContext> = {},
): ResourceRegistrationContext {
	return {
		server: {} as any,
		connectionManager: {} as any,
		config: DEFAULT_APP_CONFIG,
		auditLogger: new AuditLogger(),
		...overrides,
	};
}

describe('resource helpers', () => {
	test('assertResourcePolicy blocks disallowed profiles', () => {
		const context = makeContext({
			config: {
				...DEFAULT_APP_CONFIG,
				policy: {
					...DEFAULT_APP_CONFIG.policy,
					allowedProfiles: ['staging'],
				},
			},
		});

		expect(() =>
			assertResourcePolicy(context, 'temporal.workflow.describe', {
				profile: 'production',
				namespace: 'default',
			}),
		).toThrow();
	});

	test('assertResourcePolicy allows matching profile and namespace', () => {
		const context = makeContext({
			config: {
				...DEFAULT_APP_CONFIG,
				policy: {
					...DEFAULT_APP_CONFIG.policy,
					allowedProfiles: ['staging'],
					allowedNamespaces: ['default'],
				},
			},
		});

		expect(() =>
			assertResourcePolicy(context, 'temporal.workflow.describe', {
				profile: 'staging',
				namespace: 'default',
			}),
		).not.toThrow();
	});

	test('assertResourcePolicy throws when tool contract is missing', () => {
		const context = makeContext();
		expect(() =>
			assertResourcePolicy(context, 'nonexistent.tool', {
				profile: 'default',
				namespace: 'default',
			}),
		).toThrow();
	});

	test('jsonResourceContent redacts sensitive fields', () => {
		const content = jsonResourceContent(new URL('temporal:///x'), {
			token: 'secret-value',
			workflowId: 'wf-123',
		});
		const parsed = JSON.parse(content.text);
		expect(parsed.token).toBe('[REDACTED]');
		expect(parsed.workflowId).toBe('wf-123');
	});
});
