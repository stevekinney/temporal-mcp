import { describe, expect, test } from 'bun:test';
import {
	TOOL_CONTRACTS,
	getToolContract,
	getAllToolContracts,
	assertToolAvailable,
} from '../src/capability-matrix.ts';
import type { ErrorEnvelope } from '../../server/src/contracts/error-envelope.ts';

const ALL_R1_TOOL_NAMES = [
	// Workflow family
	'temporal.workflow.list',
	'temporal.workflow.describe',
	'temporal.workflow.count',
	'temporal.workflow.result',
	'temporal.workflow.query',
	'temporal.workflow.history',
	'temporal.workflow.history.reverse',
	'temporal.workflow.history.summarize',
	// Schedule family
	'temporal.schedule.list',
	'temporal.schedule.describe',
	'temporal.schedule.matching-times',
	// Infrastructure family
	'temporal.task-queue.describe',
	'temporal.task-queue.configuration',
	'temporal.namespace.list',
	'temporal.namespace.describe',
	'temporal.search-attributes.list',
	'temporal.cluster.info',
	// Worker family
	'temporal.worker.versioning-rules',
	'temporal.worker.task-reachability',
	'temporal.worker.deployment.list',
	'temporal.worker.deployment.describe',
	'temporal.worker.deployment.version.describe',
	'temporal.worker.deployment.reachability',
	// Connection family
	'temporal.connection.check',
	// Docs family
	'docs.status',
	'docs.search',
	'docs.get',
	'docs.refresh',
];

const VALID_RISKS = ['read', 'write', 'destructive', 'admin'] as const;
const VALID_BACKENDS = [
	'sdk',
	'workflow-service',
	'operator-service',
	'cloud',
	'cli',
] as const;
const VALID_AVAILABILITIES = ['self-hosted', 'cloud', 'both'] as const;
const VALID_STABILITIES = ['stable', 'experimental', 'deprecated'] as const;

describe('TOOL_CONTRACTS', () => {
	test('has the expected number of R1 tool entries', () => {
		expect(TOOL_CONTRACTS.size).toBe(ALL_R1_TOOL_NAMES.length);
	});

	test('contains every R1 tool name', () => {
		for (const name of ALL_R1_TOOL_NAMES) {
			expect(TOOL_CONTRACTS.has(name)).toBe(true);
		}
	});

	test('all tool contracts have valid field values', () => {
		for (const [name, contract] of TOOL_CONTRACTS) {
			expect(contract.name).toBe(name);
			expect(VALID_RISKS).toContain(contract.risk);
			expect(VALID_BACKENDS).toContain(contract.implementationBackend);
			expect(VALID_AVAILABILITIES).toContain(contract.availability);
			expect(VALID_STABILITIES).toContain(contract.stability);
			expect(typeof contract.idempotent).toBe('boolean');
			expect(typeof contract.supportsCancellation).toBe('boolean');
			expect(typeof contract.supportsTasks).toBe('boolean');
		}
	});
});

describe('getToolContract', () => {
	test('returns the expected contract for temporal.workflow.list', () => {
		const contract = getToolContract('temporal.workflow.list');
		expect(contract).toBeDefined();
		expect(contract!.name).toBe('temporal.workflow.list');
		expect(contract!.risk).toBe('read');
		expect(contract!.idempotent).toBe(true);
		expect(contract!.supportsCancellation).toBe(true);
		expect(contract!.supportsTasks).toBe(false);
		expect(contract!.implementationBackend).toBe('sdk');
		expect(contract!.availability).toBe('both');
		expect(contract!.stability).toBe('stable');
	});

	test('returns undefined for a nonexistent tool', () => {
		expect(getToolContract('nonexistent.tool')).toBeUndefined();
	});
});

describe('getAllToolContracts', () => {
	test('returns the same map as TOOL_CONTRACTS', () => {
		expect(getAllToolContracts()).toBe(TOOL_CONTRACTS);
	});
});

describe('assertToolAvailable', () => {
	test('does not throw for temporal.workflow.list with self-hosted', () => {
		expect(() =>
			assertToolAvailable('temporal.workflow.list', 'self-hosted'),
		).not.toThrow();
	});

	test('does not throw for temporal.workflow.list with cloud (availability is both)', () => {
		expect(() =>
			assertToolAvailable('temporal.workflow.list', 'cloud'),
		).not.toThrow();
	});

	test('throws UNSUPPORTED_IN_PROFILE for temporal.namespace.list with cloud', () => {
		try {
			assertToolAvailable('temporal.namespace.list', 'cloud');
			expect.unreachable('should have thrown');
		} catch (error) {
			const envelope = error as ErrorEnvelope;
			expect(envelope.ok).toBe(false);
			expect(envelope.error.code).toBe('UNSUPPORTED_IN_PROFILE');
			expect(envelope.error.message).toContain('temporal.namespace.list');
			expect(envelope.error.message).toContain('cloud');
		}
	});

	test('does not throw for temporal.namespace.list with self-hosted', () => {
		expect(() =>
			assertToolAvailable('temporal.namespace.list', 'self-hosted'),
		).not.toThrow();
	});

	test('throws TOOL_NOT_FOUND for a nonexistent tool', () => {
		try {
			assertToolAvailable('nonexistent.tool', 'self-hosted');
			expect.unreachable('should have thrown');
		} catch (error) {
			const envelope = error as ErrorEnvelope;
			expect(envelope.ok).toBe(false);
			expect(envelope.error.code).toBe('TOOL_NOT_FOUND');
			expect(envelope.error.message).toContain('nonexistent.tool');
		}
	});
});
