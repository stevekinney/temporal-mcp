import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { AuditLogger } from '../../src/safety/audit-log.ts';
import type { RequestContext } from '../../src/safety/request-context.ts';
import type { PolicyDecision } from '../../src/contracts/policy.ts';

function createRequestContext(
	overrides: Partial<RequestContext> = {},
): RequestContext {
	return {
		requestId: 'test-request-id',
		toolName: 'temporal.workflow.list',
		timestamp: '2026-03-09T00:00:00.000Z',
		...overrides,
	};
}

describe('AuditLogger', () => {
	let logger: AuditLogger;
	let stderrOutput: string[];
	let originalError: typeof console.error;

	beforeEach(() => {
		logger = new AuditLogger();
		stderrOutput = [];
		originalError = console.error;
		console.error = (...args: unknown[]) => {
			stderrOutput.push(args.map(String).join(' '));
		};
	});

	afterEach(() => {
		console.error = originalError;
	});

	describe('logToolCall', () => {
		test('emits structured JSON with tool_call type', () => {
			const context = createRequestContext();
			logger.logToolCall(context, {
				profile: 'default',
				query: 'test',
			});

			expect(stderrOutput).toHaveLength(1);
			const entry = JSON.parse(stderrOutput[0]!);
			expect(entry.type).toBe('tool_call');
			expect(entry.context.requestId).toBe('test-request-id');
			expect(entry.context.toolName).toBe('temporal.workflow.list');
			expect(entry.args.profile).toBe('default');
			expect(entry.args.query).toBe('test');
			expect(entry.timestamp).toBeDefined();
		});

		test('sanitizes sensitive args (apiKey)', () => {
			const context = createRequestContext();
			logger.logToolCall(context, {
				profile: 'default',
				apiKey: 'super-secret-key',
			});

			const entry = JSON.parse(stderrOutput[0]!);
			expect(entry.args.apiKey).toBe('[REDACTED]');
			expect(entry.args.profile).toBe('default');
		});

		test('sanitizes sensitive args (password)', () => {
			const context = createRequestContext();
			logger.logToolCall(context, {
				userPassword: 'my-password',
				name: 'test',
			});

			const entry = JSON.parse(stderrOutput[0]!);
			expect(entry.args.userPassword).toBe('[REDACTED]');
			expect(entry.args.name).toBe('test');
		});

		test('sanitizes sensitive args (token)', () => {
			const context = createRequestContext();
			logger.logToolCall(context, {
				accessToken: 'bearer-xyz',
				id: '123',
			});

			const entry = JSON.parse(stderrOutput[0]!);
			expect(entry.args.accessToken).toBe('[REDACTED]');
			expect(entry.args.id).toBe('123');
		});

		test('sanitizes sensitive args (secret)', () => {
			const context = createRequestContext();
			logger.logToolCall(context, {
				clientSecret: 'shhh',
			});

			const entry = JSON.parse(stderrOutput[0]!);
			expect(entry.args.clientSecret).toBe('[REDACTED]');
		});

		test('sanitizes additional sensitive args (authorization/cookie/session)', () => {
			const context = createRequestContext();
			logger.logToolCall(context, {
				authorization: 'Bearer token',
				cookieHeader: 'session=abc123',
				sessionId: 'session-value',
				visibleField: 'safe',
			});

			const entry = JSON.parse(stderrOutput[0]!);
			expect(entry.args.authorization).toBe('[REDACTED]');
			expect(entry.args.cookieHeader).toBe('[REDACTED]');
			expect(entry.args.sessionId).toBe('[REDACTED]');
			expect(entry.args.visibleField).toBe('safe');
		});
	});

	describe('logToolResult', () => {
		test('includes status and duration', () => {
			const context = createRequestContext();
			logger.logToolResult(context, 'success', 42);

			expect(stderrOutput).toHaveLength(1);
			const entry = JSON.parse(stderrOutput[0]!);
			expect(entry.type).toBe('tool_result');
			expect(entry.status).toBe('success');
			expect(entry.durationMs).toBe(42);
			expect(entry.context.toolName).toBe('temporal.workflow.list');
		});

		test('records error status', () => {
			const context = createRequestContext();
			logger.logToolResult(context, 'error', 100);

			const entry = JSON.parse(stderrOutput[0]!);
			expect(entry.status).toBe('error');
			expect(entry.durationMs).toBe(100);
		});
	});

	describe('logPolicyDecision', () => {
		test('includes the decision', () => {
			const context = createRequestContext();
			const decision: PolicyDecision = {
				allowed: true,
				reason: 'Policy check passed',
				code: 'ALLOWED',
			};
			logger.logPolicyDecision(context, decision);

			expect(stderrOutput).toHaveLength(1);
			const entry = JSON.parse(stderrOutput[0]!);
			expect(entry.type).toBe('policy_decision');
			expect(entry.decision.allowed).toBe(true);
			expect(entry.decision.reason).toBe('Policy check passed');
			expect(entry.decision.code).toBe('ALLOWED');
		});

		test('includes denied decision details', () => {
			const context = createRequestContext();
			const decision: PolicyDecision = {
				allowed: false,
				reason: 'Hard read-only mode blocks write operations',
				code: 'HARD_READ_ONLY',
			};
			logger.logPolicyDecision(context, decision);

			const entry = JSON.parse(stderrOutput[0]!);
			expect(entry.decision.allowed).toBe(false);
			expect(entry.decision.code).toBe('HARD_READ_ONLY');
		});
	});
});
