# Contributing

## Development workflow

1. Create a task-scoped branch.
2. Implement changes inside owned path boundaries.
3. Add/update tests for changed behavior.
4. Run typecheck, lint, and tests.
5. Submit with structured handoff payload.

## Contract changes

Do not modify `packages/server/src/contracts/**` unless a contract-change task is approved.
If changed, bump `contractsVersion` and update architecture notes.

## Quality gates

- No hardcoded secrets.
- No stdout logging for stdio server runtime.
- Policy checks must execute before side effects.
