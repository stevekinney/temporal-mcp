import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { evaluatePolicy } from '../../src/policy/evaluate.ts';
import type { PolicyConfig } from '../../src/contracts/policy.ts';
import type { ToolContract } from '../../src/contracts/tool-contract.ts';

function makeToolContract(overrides: Partial<ToolContract> = {}): ToolContract {
	return {
		name: 'temporal.workflow.list',
		risk: 'read',
		idempotent: true,
		supportsCancellation: false,
		supportsTasks: false,
		implementationBackend: 'sdk',
		availability: 'both',
		stability: 'stable',
		...overrides,
	};
}

function makeConfig(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
	return {
		mode: 'readOnly',
		hardReadOnly: false,
		allowedProfiles: [],
		allowedNamespaces: [],
		allowPatterns: [],
		denyPatterns: [],
		breakGlassVariable: 'TEMPORAL_MCP_BREAK_GLASS',
		...overrides,
	};
}

describe('evaluatePolicy', () => {
	describe('hardReadOnly', () => {
		test('blocks write operations when hardReadOnly is true', () => {
			const config = makeConfig({ hardReadOnly: true });
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('HARD_READ_ONLY');
		});

		test('blocks destructive operations when hardReadOnly is true', () => {
			const config = makeConfig({ hardReadOnly: true });
			const tool = makeToolContract({ risk: 'destructive' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('HARD_READ_ONLY');
		});

		test('blocks admin operations when hardReadOnly is true', () => {
			const config = makeConfig({ hardReadOnly: true });
			const tool = makeToolContract({ risk: 'admin' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('HARD_READ_ONLY');
		});

		test('allows read operations when hardReadOnly is true', () => {
			const config = makeConfig({ hardReadOnly: true });
			const tool = makeToolContract({ risk: 'read' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});
	});

	describe('readOnly mode', () => {
		test('allows read operations', () => {
			const config = makeConfig({ mode: 'readOnly' });
			const tool = makeToolContract({ risk: 'read' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});

		test('blocks write operations', () => {
			const config = makeConfig({ mode: 'readOnly' });
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('MODE_BLOCKED');
		});

		test('blocks destructive operations', () => {
			const config = makeConfig({ mode: 'readOnly' });
			const tool = makeToolContract({ risk: 'destructive' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('MODE_BLOCKED');
		});

		test('blocks admin operations', () => {
			const config = makeConfig({ mode: 'readOnly' });
			const tool = makeToolContract({ risk: 'admin' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('MODE_BLOCKED');
		});
	});

	describe('safeWrite mode', () => {
		test('allows read operations', () => {
			const config = makeConfig({ mode: 'safeWrite' });
			const tool = makeToolContract({ risk: 'read' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});

		test('allows write operations', () => {
			const config = makeConfig({ mode: 'safeWrite' });
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});

		test('blocks destructive operations', () => {
			const config = makeConfig({ mode: 'safeWrite' });
			const tool = makeToolContract({ risk: 'destructive' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('MODE_BLOCKED');
		});

		test('blocks admin operations', () => {
			const config = makeConfig({ mode: 'safeWrite' });
			const tool = makeToolContract({ risk: 'admin' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('MODE_BLOCKED');
		});
	});

	describe('custom mode', () => {
		test('allows any risk level when no patterns are set', () => {
			const config = makeConfig({ mode: 'custom' });
			const tool = makeToolContract({ risk: 'admin' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});

		test('allows tool matching allow pattern', () => {
			const config = makeConfig({
				mode: 'custom',
				allowPatterns: ['temporal.workflow.*'],
			});
			const tool = makeToolContract({ name: 'temporal.workflow.list' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});

		test('blocks tool not matching any allow pattern', () => {
			const config = makeConfig({
				mode: 'custom',
				allowPatterns: ['temporal.schedule.*'],
			});
			const tool = makeToolContract({ name: 'temporal.workflow.list' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('DENY_PATTERN');
		});

		test('deny patterns take precedence over allow patterns', () => {
			const config = makeConfig({
				mode: 'custom',
				allowPatterns: ['temporal.**'],
				denyPatterns: ['temporal.workflow.terminate'],
			});
			const tool = makeToolContract({ name: 'temporal.workflow.terminate' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('DENY_PATTERN');
		});
	});

	describe('unsafe mode', () => {
		const breakGlassVariable = 'TEST_BREAK_GLASS';

		afterEach(() => {
			delete process.env[breakGlassVariable];
		});

		test('blocks when break-glass env var is not set', () => {
			delete process.env[breakGlassVariable];
			const config = makeConfig({ mode: 'unsafe', breakGlassVariable });
			const tool = makeToolContract({ risk: 'admin' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('BREAK_GLASS_REQUIRED');
		});

		test('allows when break-glass env var is set', () => {
			process.env[breakGlassVariable] = 'true';
			const config = makeConfig({ mode: 'unsafe', breakGlassVariable });
			const tool = makeToolContract({ risk: 'admin' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});

		test('allows read operations when break-glass env var is set', () => {
			process.env[breakGlassVariable] = '1';
			const config = makeConfig({ mode: 'unsafe', breakGlassVariable });
			const tool = makeToolContract({ risk: 'read' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});
	});

	describe('profile allowlist', () => {
		test('blocks when profile is not in the allowed list', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				allowedProfiles: ['production', 'staging'],
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, { profile: 'development' });
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('PROFILE_NOT_ALLOWED');
		});

		test('allows when profile is in the allowed list', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				allowedProfiles: ['production', 'staging'],
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, { profile: 'production' });
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});

		test('empty allowedProfiles means allow all profiles', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				allowedProfiles: [],
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, { profile: 'anything' });
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});

		test('allows when no profile is provided in context', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				allowedProfiles: ['production'],
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});
	});

	describe('namespace allowlist', () => {
		test('blocks when namespace is not in the allowed list', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				allowedNamespaces: ['default', 'production'],
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, { namespace: 'staging' });
			expect(result.allowed).toBe(false);
			expect(result.code).toBe('NAMESPACE_NOT_ALLOWED');
		});

		test('allows when namespace is in the allowed list', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				allowedNamespaces: ['default', 'production'],
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, { namespace: 'default' });
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});

		test('empty allowedNamespaces means allow all namespaces', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				allowedNamespaces: [],
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, { namespace: 'anything' });
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});

		test('allows when no namespace is provided in context', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				allowedNamespaces: ['production'],
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
		});
	});

	describe('default behavior', () => {
		test('returns ALLOWED when nothing blocks the tool', () => {
			const config = makeConfig({ mode: 'safeWrite' });
			const tool = makeToolContract({ risk: 'read' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.allowed).toBe(true);
			expect(result.code).toBe('ALLOWED');
			expect(result.reason).toBe('Policy check passed');
		});
	});

	describe('evaluation order', () => {
		test('hardReadOnly takes precedence over mode', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				hardReadOnly: true,
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.code).toBe('HARD_READ_ONLY');
		});

		test('deny patterns take precedence over allow patterns', () => {
			const config = makeConfig({
				mode: 'custom',
				allowPatterns: ['temporal.**'],
				denyPatterns: ['temporal.workflow.list'],
			});
			const tool = makeToolContract({ name: 'temporal.workflow.list' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.code).toBe('DENY_PATTERN');
		});

		test('deny patterns are checked before mode', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				denyPatterns: ['temporal.workflow.list'],
			});
			const tool = makeToolContract({ name: 'temporal.workflow.list', risk: 'read' });
			const result = evaluatePolicy(config, tool, {});
			expect(result.code).toBe('DENY_PATTERN');
		});

		test('mode is checked before profile allowlist', () => {
			const config = makeConfig({
				mode: 'readOnly',
				allowedProfiles: ['production'],
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, { profile: 'development' });
			expect(result.code).toBe('MODE_BLOCKED');
		});

		test('profile is checked before namespace', () => {
			const config = makeConfig({
				mode: 'safeWrite',
				allowedProfiles: ['production'],
				allowedNamespaces: ['default'],
			});
			const tool = makeToolContract({ risk: 'write' });
			const result = evaluatePolicy(config, tool, {
				profile: 'development',
				namespace: 'staging',
			});
			expect(result.code).toBe('PROFILE_NOT_ALLOWED');
		});
	});
});
