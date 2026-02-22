/**
 * Contract version for agent-orchestrated execution waves.
 *
 * Freeze rule:
 * - No contract edits without an approved contract-change task.
 * - Any contract change must increment this value.
 */
export const contractsVersion = 1;
