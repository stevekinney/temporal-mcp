import { expect, test } from 'bun:test';
import { contractsVersion } from '../../src/contracts/version';

test('contractsVersion is a positive integer', () => {
  expect(Number.isInteger(contractsVersion)).toBeTrue();
  expect(contractsVersion).toBeGreaterThan(0);
});
