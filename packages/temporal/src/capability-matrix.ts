import type {
	ToolContract,
	Availability,
} from '../../server/src/contracts/tool-contract.ts';
import type { ProfileKind } from '../../server/src/contracts/config.ts';
import type { ErrorEnvelope } from '../../server/src/contracts/error-envelope.ts';

function contract(
	name: string,
	overrides: Partial<
		Pick<
			ToolContract,
			| 'implementationBackend'
			| 'availability'
			| 'stability'
			| 'supportsCancellation'
			| 'supportsTasks'
		>
	> = {},
): [string, ToolContract] {
	return [
		name,
		{
			name,
			risk: 'read',
			idempotent: true,
			supportsCancellation: overrides.supportsCancellation ?? true,
			supportsTasks: overrides.supportsTasks ?? false,
			implementationBackend: overrides.implementationBackend ?? 'sdk',
			availability: overrides.availability ?? 'both',
			stability: overrides.stability ?? 'stable',
		},
	];
}

export const TOOL_CONTRACTS: ReadonlyMap<string, ToolContract> = new Map([
	// Workflow family
	contract('temporal.workflow.list'),
	contract('temporal.workflow.describe'),
	contract('temporal.workflow.count'),
	contract('temporal.workflow.result'),
	contract('temporal.workflow.query'),
	contract('temporal.workflow.history'),
	contract('temporal.workflow.history.reverse', {
		implementationBackend: 'workflow-service',
	}),
	contract('temporal.workflow.history.summarize', {
		supportsCancellation: false,
	}),

	// Schedule family
	contract('temporal.schedule.list'),
	contract('temporal.schedule.describe'),
	contract('temporal.schedule.matching-times', {
		implementationBackend: 'workflow-service',
	}),

	// Infrastructure family
	contract('temporal.task-queue.describe', {
		implementationBackend: 'workflow-service',
	}),
	contract('temporal.task-queue.configuration', {
		implementationBackend: 'workflow-service',
	}),
	contract('temporal.namespace.list', {
		implementationBackend: 'workflow-service',
		availability: 'self-hosted',
	}),
	contract('temporal.namespace.describe', {
		implementationBackend: 'workflow-service',
	}),
	contract('temporal.search-attributes.list', {
		implementationBackend: 'operator-service',
	}),
	contract('temporal.cluster.info', {
		implementationBackend: 'workflow-service',
		supportsCancellation: false,
	}),

	// Worker family
	contract('temporal.worker.versioning-rules', {
		implementationBackend: 'workflow-service',
		stability: 'experimental',
	}),
	contract('temporal.worker.task-reachability', {
		stability: 'experimental',
	}),
	contract('temporal.worker.deployment.list', {
		implementationBackend: 'workflow-service',
		stability: 'experimental',
	}),
	contract('temporal.worker.deployment.describe', {
		implementationBackend: 'workflow-service',
		stability: 'experimental',
	}),
	contract('temporal.worker.deployment.version.describe', {
		implementationBackend: 'workflow-service',
		stability: 'experimental',
	}),
	contract('temporal.worker.deployment.reachability', {
		implementationBackend: 'workflow-service',
		stability: 'experimental',
	}),

	// Connection family
	contract('temporal.connection.check', {
		implementationBackend: 'workflow-service',
		supportsCancellation: false,
	}),

	// Docs family
	contract('docs.status', { supportsCancellation: false }),
	contract('docs.search', { supportsCancellation: false }),
	contract('docs.get', { supportsCancellation: false }),
	contract('docs.refresh', { supportsCancellation: false }),
]);

export function getToolContract(name: string): ToolContract | undefined {
	return TOOL_CONTRACTS.get(name);
}

export function getAllToolContracts(): ReadonlyMap<string, ToolContract> {
	return TOOL_CONTRACTS;
}

function isAvailableForProfile(
	availability: Availability,
	profileKind: ProfileKind,
): boolean {
	if (availability === 'both') return true;
	return availability === profileKind;
}

function createError(code: string, message: string): ErrorEnvelope {
	return {
		ok: false,
		error: { code, message, retryable: false },
	};
}

export function assertToolAvailable(
	toolName: string,
	profileKind: ProfileKind,
): void {
	const toolContract = TOOL_CONTRACTS.get(toolName);

	if (!toolContract) {
		throw createError(
			'TOOL_NOT_FOUND',
			`Tool "${toolName}" is not registered in the capability matrix`,
		);
	}

	if (!isAvailableForProfile(toolContract.availability, profileKind)) {
		throw createError(
			'UNSUPPORTED_IN_PROFILE',
			`Tool "${toolName}" is not available for ${profileKind} profiles (requires ${toolContract.availability})`,
		);
	}
}
