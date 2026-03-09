import { describe, expect, test } from 'bun:test';
import * as contracts from '../../src/contracts';

describe('contracts barrel exports', () => {
  test('exports key contract constants and examples', () => {
    expect(contracts.contractsVersion).toBeDefined();
    expect(contracts.TOOL_CONTRACT_EXAMPLE).toBeDefined();
  });

  test('example export remains stable for downstream consumers', () => {
    expect(contracts.TOOL_CONTRACT_EXAMPLE.contract.name).toBe(
      'temporal.workflow.describe',
    );
    expect(contracts.TOOL_CONTRACT_EXAMPLE.contract.implementationBackend).toBe(
      'sdk',
    );
  });
});
