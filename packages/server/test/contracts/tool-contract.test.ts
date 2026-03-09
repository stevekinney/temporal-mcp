import { describe, expect, test } from 'bun:test';
import {
  TOOL_CONTRACT_EXAMPLE,
  type Availability,
  type ImplementationBackend,
  type Risk,
  type Stability,
} from '../../src/contracts/tool-contract';

describe('tool contract', () => {
  test('example contract uses valid enum values', () => {
    const allowedRisk: Risk[] = ['read', 'write', 'destructive', 'admin'];
    const allowedBackends: ImplementationBackend[] = [
      'sdk',
      'workflow-service',
      'operator-service',
      'cloud',
      'cli',
    ];
    const allowedAvailability: Availability[] = ['self-hosted', 'cloud', 'both'];
    const allowedStability: Stability[] = ['stable', 'experimental', 'deprecated'];

    expect(allowedRisk).toContain(TOOL_CONTRACT_EXAMPLE.contract.risk);
    expect(allowedBackends).toContain(
      TOOL_CONTRACT_EXAMPLE.contract.implementationBackend,
    );
    expect(allowedAvailability).toContain(
      TOOL_CONTRACT_EXAMPLE.contract.availability,
    );
    expect(allowedStability).toContain(TOOL_CONTRACT_EXAMPLE.contract.stability);
  });

  test('example contract required fields are populated', () => {
    const example = TOOL_CONTRACT_EXAMPLE.contract;

    expect(example.name).toBe('temporal.workflow.describe');
    expect(example.idempotent).toBeTrue();
    expect(example.supportsCancellation).toBeTrue();
    expect(example.supportsTasks).toBeFalse();
  });
});
