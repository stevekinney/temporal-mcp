# Contributing

This repository uses Bun for local development and CI.

## Local Validation

Run this workflow before opening a pull request:

```bash
bun install --frozen-lockfile
bun run check
```

`bun run check` is the canonical quality gate and runs:

1. `bun run typecheck`
2. `bun run test`

## Coverage

Coverage is tracked separately from the canonical check:

```bash
bun run test:coverage
```

Run coverage when you need visibility into test coverage changes. No numeric coverage threshold is enforced by default in this workflow.

## CI Parity Principle

The primary CI gate mirrors local validation by running:

```bash
bun run check
```

CI also runs a separate coverage job (`bun run test:coverage`) for visibility.

## Build Artifacts

Build distributable JavaScript and declaration files with:

```bash
bun run build
```

The build uses Bun for compilation and TypeScript declaration emit, and produces Node.js runtime artifacts under `dist/` directories.
