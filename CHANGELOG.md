# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-03-23

### Added

**Agent Skill** — a spec-compliant [Agent Skills](https://agentskills.io/specification) knowledge package at `skill/SKILL.md`. The skill is a standalone curated reference library covering Temporal architecture, determinism rules, workflow patterns, common gotchas, versioning strategies, troubleshooting decision trees, and error classification. Language-specific reference files are included for TypeScript, Python, and Go (22 files total). The skill can be used independently of the MCP server by copying `skill/` into your agent's skills directory.

**Prompt templates** — four MCP prompts are now registered and discoverable by any client that supports the prompts capability:

- `temporal-debug-workflow` — step-by-step workflow diagnosis combining live describe + history with reference lookups
- `temporal-triage` — namespace health check covering recent failures, worker connectivity, and task queue backlogs
- `temporal-docs-answer` — answers Temporal questions using the docs corpus and curated references
- `temporal-safe-mutation` — pre-flight state checks before sending a signal to a running workflow

**Guidance annotations** — `temporal.workflow.describe` and `temporal.workflow.history.summarize` now include an optional `guidance` field in their responses when the result matches a notable pattern. A timed-out workflow gets a pointer to `skill/references/core/gotchas.md`; a failed workflow to `skill/references/core/error-reference.md`; workflow task failures in a history summary to `skill/references/core/determinism.md`. The annotation is strictly additive and absent when no pattern matches.

**Curated reference indexing** — `docs.refresh` now indexes skill reference files alongside the Temporal docs corpus. Curated results receive a 1.5× score boost in `docs.search`. `docs.get` accepts paths in the form `skill/references/{category}/{file}.md`. `docs.status` reports whether the skill directory is present and how many curated chunks were indexed.

### Changed

- `docs.status` response now includes a `curatedReferences` field: `{ present: boolean, fileCount: number }`.
- `docs.search` result scores for curated references are boosted relative to raw corpus results.
- Server capabilities now declare `prompts: { listChanged: true }`.
- Project structure section and Documentation tools table in README updated to reflect new capabilities.

---

## [0.1.1] — 2026-03-12

### Fixed

- GitHub Actions workflows updated to silence Node.js 20 deprecation warnings.
- `operatorService` access path corrected for the `temporal.search-attributes.list` tool.

---

## [0.1.0] — 2026-03-12

Initial public release.

### Added

- **28 read-only tools** across six categories: workflow, schedule, infrastructure, worker, connection, and documentation.
- **5 MCP resource types** for direct URI-based access to workflows, schedules, task queues, namespaces, and documentation chunks.
- **Policy engine** with four modes (`readOnly`, `safeWrite`, `custom`, `unsafe`), glob-based tool filtering, profile and namespace allowlists, and a break-glass override requiring an explicit environment variable.
- **Multi-profile connections** to self-hosted Temporal clusters and Temporal Cloud from a single server instance.
- **Documentation subsystem** — git-synced Temporal docs corpus indexed with MiniSearch, exposed via `docs.search`, `docs.get`, `docs.status`, and `docs.refresh`.
- **Audit logging** — every tool invocation logged as structured JSON to stderr with request ID tracking and automatic sensitive-field redaction.
- **stdio transport** — server communicates over standard I/O for compatibility with Claude Desktop, Claude Code, and any MCP client that supports the stdio transport.

[0.2.0]: https://github.com/stevekinney/temporal-mcp/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/stevekinney/temporal-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/stevekinney/temporal-mcp/releases/tag/v0.1.0
