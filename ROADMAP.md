You’re building a “Temporal operator brain” that speaks MCP so an agent can:

1. Consult a local Temporal docs corpus.
2. Inspect and debug real workflow executions in self-hosted or Temporal Cloud.
3. Perform mutations only when policy allows it.

Roadmap 2.0 turns this into a release-gated, spec-complete plan with explicit MCP protocol compliance, SDK feasibility checks, and risk-scoped delivery milestones.

# Scope, Release Gates, and Non-Goals

## Locked Defaults

- `v1 deployment`: local-first stdio.
- `implementation`: SDK-first with raw gRPC fallback.
- `v1 scope`: read + safe-write GA.
- `MCP depth`: include Tasks and Elicitation in v1, labeled experimental and version-gated.

## Release Gates

- `R1 Foundation`: MCP compliance baseline + config/policy + docs + Temporal read-only core.
- `R2 GA`: safe-write operations + reliability hardening + packaging/docs/CI gates.
- `R3 Post-GA High Risk`: destructive/admin + dual-confirm + escape hatches.
- `R4 Remote Deployments`: Streamable HTTP with explicit auth mode decision (OAuth-compliant MCP auth OR internal/local-only mode).

## GA Boundary

GA is reached at the end of `R2` only when:

- Protocol conformance tests pass.
- Read + safe-write tool suites pass against local Temporal integration.
- Cloud/self-hosted routing behavior is validated.
- Policy bypass regressions are blocked in CI.

## Post-GA Boundary

The following are explicitly post-GA:

- Destructive/admin tool families.
- Batch operations.
- Raw gRPC and CLI escape hatches.
- Remote HTTP transport production mode.

## Explicit v1 Non-Goals

- Full destructive/admin surface in first GA.
- Full OAuth transport implementation in `R1/R2`.
- Treating host-specific tool-argument completion UX as MCP standard behavior.

# Stack Choices that Keep You Fast

Pick these defaults unless you have a strong reason not to.

- Use Bun as runtime and package manager.
- Use Bun workspaces + Turborepo.
- Use `zod` for tool/config validation.
- Use structured logs to stderr only in stdio mode.
- Start with lexical docs search; embeddings are opt-in later.

# Design Decisions

Cross-cutting decisions affecting multiple slices.

## Publishing and Distribution

Publish `@temporal-mcp/server` as the single installable package. Internal packages (`@temporal-mcp/temporal`, `@temporal-mcp/docs`) are bundled into the server artifact and not published independently.

## Runtime Support

This is Bun-only for v1/v2. Node compatibility is deferred and requires a dedicated runtime abstraction layer.

## Config File Discovery

First match wins:

1. `--config <path>`
2. `TEMPORAL_MCP_CONFIG`
3. `.temporal-mcp.json` in cwd
4. `~/.config/temporal-mcp/config.json`

If no config is found: server starts with defaults, docs enabled, policy mode `readOnly`, and Temporal tools return structured “profile not configured” errors.

## State File Location

Use one state root in cwd:

- `.temporal-mcp/sync-meta.json`
- `.temporal-mcp/state.json`
- `.temporal-mcp/cache/`

## Integration Testing Strategy

- Primary: `@temporalio/testing` (`TestWorkflowEnvironment.createLocal()`).
- Secondary: mocked gRPC for hard-to-reproduce edge cases.
- Optional local contributor setup: Docker compose.
- Cloud integration tests: separate non-blocking release-branch job.

## Sampling and Data Privacy

- Redaction runs before sampling.
- Sampling controlled by policy (`enabled`, `maxPayloadBytes`).
- Sampling audit logs include metadata only (not payload data).

## Git as Runtime Dependency

Git is soft dependency.

- Missing git disables docs subsystem with structured `docs_unavailable` errors.
- Temporal features remain fully functional.

## Concurrency Limits

- Per-profile semaphore default: 10.
- Global Temporal ceiling default: 25.
- Request timeout default: 30s.

## Multi-Host Sessions

- Stdio: single-session.
- HTTP: multi-session with shared config/pool/index.
- No per-session policy override.

## Resource Inline Threshold

- Global inline threshold default: 32KB.
- Above threshold: summary + resource URI.

## Custom Policy Mode

`custom` is allow/deny-list driven. It has no implicit risk limits; `hardReadOnly` is the global override.

## Experimental Feature Lifecycle

Experimental tools are shipped with stable names but clearly annotated in tool descriptions and docs. Removal path includes one major-version deprecation window with structured `feature_removed` errors.

## Config Versioning and Migration

- Top-level `version` field in config.
- Deterministic migration chain.
- Unknown future config versions fail fast.

## Profile Typing and Routing Rules

Add profile kind:

- `temporal.profiles.<name>.kind = "selfHosted" | "cloud"`

Routing rules:

- Tools requiring `operatorService` are self-hosted only unless an equivalent Cloud API path exists.
- Cloud admin flows use `@temporalio/cloud` where required.
- Unsupported backend/profile combinations fail with structured code:
  - `unsupported_in_profile`
  - `operator_service_unavailable`
  - `cloud_api_unavailable`

## Transport Policy Split

- `R1/R2`: stdio only.
- `R4`: Streamable HTTP only after explicit auth mode decision:
  - MCP authorization/OAuth-compliant mode, or
  - documented internal/local-only mode.

# MCP Compliance Baseline (Must Ship Before Domain Tools)

This section is mandatory and precedes Temporal/domain feature slices.

## Protocol Lifecycle Requirements

Implement and test:

- `initialize` handshake.
- Protocol version negotiation.
- Capability negotiation (server + client).
- Graceful shutdown behavior.

## Required Utilities

Implement and test:

- `ping`
- cancellation (`notifications/cancelled` handling + propagation)
- progress (`notifications/progress` with tokens)
- pagination semantics for list operations
- structured logging to MCP (`notifications/message`)

## Dynamic List Notifications

When capabilities declare support, emit:

- `notifications/tools/list_changed`
- `notifications/resources/list_changed`
- `notifications/prompts/list_changed`

## Acceptance Criteria

- Conformance suite validates lifecycle, cancellation, progress, pagination, and logging behavior.
- No domain tool implementation may bypass the baseline plumbing.

## Edge-case checklist

- Initialize without expected host capabilities.
- Host sends cancellation after server completed result.
- Progress tokens reused or missing.
- Pagination token corruption/expiration.

# Tool Contract and Registry Metadata (Required Before Tool Expansion)

Every tool must declare a typed contract in a machine-readable registry.

## Required Tool Metadata

- `risk: read | write | destructive | admin`
- `idempotent: boolean`
- `supportsCancellation: boolean`
- `supportsTasks: boolean`
- `implementationBackend: sdk | workflowService | operatorService | cloud | cli`
- `availability: selfHosted | cloud | both`
- `stability: stable | experimental | deprecated`

## Required Tool Response Shape

- High-value tools return `outputSchema` + `structuredContent`.
- Standard error envelope:

```ts
{
  ok: false,
  error: {
    code: string,
    message: string,
    retryable?: boolean,
    details?: Record<string, unknown>
  }
}
```

## Acceptance Criteria

- Tool registry can generate docs and contract tests.
- CI fails if code and generated contracts diverge.

## Edge-case checklist

- Missing metadata on new tools.
- Tool declares unsupported availability and is still callable.
- Structured output mismatch vs declared schema.

# Temporal API Capability Matrix (Plan Gate)

Before implementing each tool family, classify backend feasibility and environment support.

## Classification Columns

- Backend path: high-level SDK / raw `workflowService` / raw `operatorService` / `@temporalio/cloud` / CLI fallback.
- Environment: self-hosted only / cloud only / both.
- Stability: stable / deprecated / experimental.
- Minimum server/version assumptions.

## Matrix (Initial)

| Family | Backend Default | Availability | Stability Notes | Min Server Version / Gate |
| --- | --- | --- | --- | --- |
| Workflow list/count/describe/query/result/history | SDK high-level (`WorkflowClient`) | both | stable | none (capability probe still required) |
| Workflow start/execute/signal/update/signalWithStart/updateWithStart | SDK high-level | both | stable | none (capability probe still required) |
| Workflow cancel/terminate | SDK high-level | both | stable | none (capability probe still required) |
| Workflow pause/unpause | raw `workflowService` | version-dependent both | experimental | feature/capability probe required |
| Workflow delete | raw `workflowService` | both (permissions/version dependent) | advanced | feature/capability probe required |
| Schedule create/update/delete/trigger/backfill/list/describe | SDK high-level (`ScheduleClient`) | both | stable | schedule API enabled in cluster |
| Schedule list matching times | raw `workflowService` | both | advanced | feature/capability probe required |
| Async activity complete/fail/heartbeat/reportCancellation | SDK high-level (`AsyncCompletionClient`) | both | stable | none (capability probe still required) |
| Activity updateOptions/pause/unpause/reset | raw `workflowService` | version-dependent both | advanced/experimental | feature/capability probe required |
| Task queue describe | raw `workflowService` (or SDK wrapper) | both | stable | none (capability probe still required) |
| Task queue config get/set | raw `workflowService` | both (permissions/version dependent) | advanced | feature/capability probe required |
| Worker versioning rules get/update | raw `workflowService` | both (server capability) | current model | feature/capability probe required |
| Build-ID compatibility APIs | SDK `TaskQueueClient` | both | deprecated | supported but deprecated; migration warning required |
| Worker deployments list/describe/set/delete | raw `workflowService` | both (newer server capability) | evolving | feature/capability probe required |
| Search attributes add/remove | raw `operatorService` (self-hosted) / Cloud API path | split | admin | self-hosted operator API OR Cloud ops API enabled |
| Namespace CRUD | `workflowService`/`operatorService` self-hosted, `@temporalio/cloud` for cloud | split | admin | backend-specific capability and permission gates |
| Batch operations | raw `workflowService` | both (permissions/version dependent) | high risk | feature/capability probe + unsafe policy gate |

## Acceptance Criteria

- Matrix is stored in-source and referenced by tooling/docs generation.
- Each tool implementation includes backend + availability assertions.

## Edge-case checklist

- Cloud profile attempting operator-service operation.
- Deprecated API path used when newer path exists.
- Capability exists in proto but cluster rejects due to version/permissions.

# Repo Bootstrapping from Scratch

```bash
mkdir temporal-mcp-server
cd temporal-mcp-server
git init
bun init -y
bun add -D turbo @types/bun typescript eslint prettier eslint-config-prettier
```

Create monorepo:

```txt
packages/
  server/
  temporal/
  docs/
```

Acceptance: `bun run dev`, `bun test`, `bun run build` work repo-wide.

## Edge-case checklist

- Reproducible install from clean cache.
- Bun version drift.
- Workspace resolution failures in CI.

# First Runnable MCP Server Skeleton

Get the protocol loop running with stdio and one sanity tool (`ping`).

Acceptance:

- Host connects.
- `tools/list` and `tools/call` work.
- No stdout corruption in stdio mode.

## Edge-case checklist

- Accidental stdout logging breaks transport.
- Unhandled exception during startup exits non-deterministically.

# Configuration System Before Real Features

Add config schema with required new fields.

## Required Schema Additions

```ts
mcp: {
  capabilities: {
    tasks: boolean,
    elicitation: boolean,
    roots: boolean,
    completions: boolean,
  }
}

transport: {
  mode: "stdio" | "http",
  stdio: { enabled: boolean },
  http: {
    enabled: boolean,
    bind: string,
    authStrategy: "oauth" | "internal",
    internalMode?: "localhost" | "private-network"
  }
}

temporal.profiles.<name>.kind: "selfHosted" | "cloud"

security: {
  confirmTokenTtlSec: number,
  maxTaskTtlSec: number,
  codecAllowlist: string[],
  idempotencyWindowSec: number,
}
```

Include `--print-effective-config` and strict startup validation.

Acceptance:

- Config discovery order works.
- Invalid fields fail with exact field paths.
- Effective config print includes defaults/migrations.

## Edge-case checklist

- Missing default profile.
- Selected profile absent.
- Unknown capability flags.
- Invalid profile kind routing.

# Policy Engine Before Temporal Tools

Enforce policy for all tool paths.

## Policy Requirements

- Risk gating by mode (`readOnly`, `safeWrite`, `custom`, `unsafe`).
- `hardReadOnly` override.
- Profile/namespace allowlists.
- Allow/deny tool patterns.
- Break-glass requirements.

Return structured policy errors.

Acceptance:

- Full policy matrix unit-tested.
- No unguarded tool path.

## Edge-case checklist

- `custom` mode with empty allow/deny lists.
- Break-glass var missing.
- Wildcard pattern over-matching.

# Tasks + Elicitation + Roots Integration (v1, Experimental)

Implement as v1 features, explicitly marked experimental.

## Tasks

Use MCP tasks for long-running operations:

- docs refresh/index
- large history retrieval
- long batch tracking flows

Support:

- `tasks/list`
- `tasks/get`
- `tasks/cancel`

## Elicitation

Use `elicitation/create` for:

- high-risk confirmations
- ambiguous operator intent capture
- optional credential handoff flow where host permits

## Roots

Use `roots/list` as scanning boundary for SDK auto-detection and project inspection.
Handle `notifications/roots/list_changed` by invalidating discovery cache.

Acceptance:

- Tasks lifecycle works with TTL and cancellation.
- Elicitation degrades gracefully if host lacks capability.
- Roots-bounded scanning enforced.

## Edge-case checklist

- Host lacks tasks/elicitation/roots capability.
- Task exceeds TTL.
- Roots changed mid-operation.

# Docs Subsystem Slice

## Sync Corpus Locally

- Clone/pull docs repo.
- Persist commit SHA and sync metadata.

## SDK Detection and Filtering

Resolution order:

1. explicit `docs.sdks`
2. project auto-detection within roots
3. optional sampling fallback
4. all-SDK fallback if unresolved

## Indexing and Chunking

- Frontmatter strip.
- MDX/Docusaurus noise strip.
- Heading-aware chunking.
- MiniSearch index fields: title/headingPath/text/sourcePath/sdk/section.

## MCP Docs Tools

- `docs.status`
- `docs.search`
- `docs.get`
- `docs.refresh`

Acceptance:

- Works without Temporal connectivity.
- Respects SDK filtering.
- Reports current corpus SHA.

## Edge-case checklist

- Git unavailable.
- Path traversal in `docs.get`.
- Stale index after partial sync.
- Sampling unavailable in SDK detection fallback.

# Temporal Connectivity Slice

- Add profile resolution using `profile.kind`.
- Cache connections by profile.
- Add `temporal.connection.check`.

Acceptance:

- Connectivity check succeeds for local and cloud profiles.
- Secrets never returned.

## Edge-case checklist

- Profile omitted and no default set.
- Cloud profile routed to self-hosted-only backend.
- Expired creds/mTLS cert errors.

# Payload Decoding and Codec Support

Pipeline:

1. Default JSON converter.
2. Optional remote codec.
3. Graceful undecoded fallback.

Security requirements:

- `security.codecAllowlist` host/domain allowlist.
- Deny private-network SSRF targets unless explicitly allowed.
- Preserve decode provenance metadata in responses.

Acceptance:

- JSON payloads decode by default.
- Codec-decoded payloads work when configured.
- Failures return explicit undecoded metadata.

## Edge-case checklist

- Codec timeout.
- Partial decode (mixed payloads).
- Malformed payload encoding metadata.

# Temporal Read-only Tools Slice (R1)

Implement read core first.

## Workflow

- `temporal.workflow.list`
- `temporal.workflow.count`
- `temporal.workflow.describe`
- `temporal.workflow.result`
- `temporal.workflow.query`
- `temporal.workflow.history.get`
- `temporal.workflow.history.getReverse`
- `temporal.workflow.history.summarize`

## Schedules

- `temporal.schedule.list`
- `temporal.schedule.describe`
- `temporal.schedule.listMatchingTimes`

## Infra + Metadata

- `temporal.taskQueue.describe`
- `temporal.taskQueue.config.get`
- `temporal.namespace.list`
- `temporal.namespace.describe`
- `temporal.searchAttributes.list`
- `temporal.cluster.info`

## Versioning + Deployments

- `temporal.worker.versioningRules.get`
- `temporal.worker.taskReachability`
- `temporal.worker.deployment.list`
- `temporal.worker.deployment.describe`
- `temporal.worker.deployment.version.describe`
- `temporal.worker.deployment.reachability`

Acceptance:

- Works in read-only mode for local + cloud where supported.
- Raw gRPC fallback used only where SDK wrappers are absent.

## Edge-case checklist

- Visibility eventual consistency affecting counts/listing.
- Continue-as-new chains causing misleading single-run assumptions.
- Large history pagination token invalidation.

# Resources and Resource Templates

Register templates for workflows, schedules, task queues, namespaces, docs.

Rule: if response exceeds `maxInlineBytes`, return summary + resource URI.

Acceptance:

- Hosts can browse templates and read resources.
- Resource reads use same redaction/decode pipeline as tools.

## Edge-case checklist

- Invalid URI parameter decoding.
- Unauthorized profile/namespace access via URI.
- Large resource memory pressure.

# Safety Hardening Slice (R1/R2)

Add:

- request IDs
- structured audit logs
- redaction filters
- MCP `notifications/message` for policy/audit/connection events

Acceptance:

- Mutating policy blocks are auditable and redacted.

## Edge-case checklist

- Log injection via user-controlled strings.
- Secret leakage in nested error objects.

# Safe-write Tools Slice (R2, GA)

Keep existing safe-write families and add execution guarantees.

## Required Safe-write Families

- workflows: start, execute, signal, signalWithStart, update, updateWithStart
- search attributes: add
- activities: complete, fail, heartbeat, reportCancellation, updateOptions, reset
- task queue config: set
- worker versioning rules: insert/replace/addRedirect/replaceRedirect/commitBuildId
- worker deployments: setCurrentVersion/setRampingVersion/updateMetadata
- schedules: create/update/trigger/backfill

## New Contract Requirements

- `requestIdempotencyKey` supported for idempotent write paths.
- Retry semantics documented per tool.
- Cancellation-aware handlers for long operations.
- Progress token support for operations likely to exceed host timeouts.

Acceptance:

- Allowed in `safeWrite/custom/unsafe`, blocked in `readOnly`.
- Idempotency replay tests pass.

## Edge-case checklist

- Duplicate idempotency key with mismatched payload.
- Retry after partial success.
- Cancellation during in-flight update/start flows.

# R3 Destructive Tools with Dual-Confirm Intent

Post-GA only.

## Tool Families

- workflow: cancel, terminate, reset, delete, pause/unpause
- activity: pause/unpause
- search attributes: remove
- versioning/deployments: delete assignment/redirect/deployments/versions
- schedules: pause/unpause/delete

## Dual-confirm Contract

Every destructive call requires:

1. Preview phase returning `confirmationToken` + affected summary + expiry.
2. Execute phase requiring token + `reason` + `force` where applicable.

Token rules:

- TTL from `security.confirmTokenTtlSec`.
- One-time use.
- Bound to caller/session/request payload hash.

Acceptance:

- Destructive calls fail without valid preview token.
- Expired/reused tokens are rejected.

## Edge-case checklist

- Confirmation token replay.
- Payload mutation between preview and execute.
- Workflow already completed by execution time.

# R3 Batch Operations Slice

Post-GA admin-only high risk.

## Batch Tools

- `temporal.batch.list`
- `temporal.batch.describe`
- `temporal.batch.terminate`
- `temporal.batch.cancel`
- `temporal.batch.signal`
- `temporal.batch.reset`
- `temporal.batch.delete`

Requirements:

- Require preview + dual-confirm + `reason` + `force=true`.
- Mandatory pre-count via `workflow.count` and count display.
- Unsafe mode + break-glass only.

Acceptance:

- Fully blocked outside unsafe+break-glass.
- Returns trackable batch job IDs.

## Edge-case checklist

- Query matches zero workflows.
- Query drift between preview and start.
- Batch execution partially succeeds.

# R3 Escape Hatches

Post-GA only.

## Raw gRPC

`temporal.grpc.call` behind strict gating:

- disabled by default
- custom/unsafe + break-glass only
- method allowlist
- payload limits
- full audit

## CLI passthrough

`temporal.cli.exec` optional with:

- command allowlist
- JSON output requirement
- stderr capture on error only

Acceptance:

- Escape hatches unavailable in GA default configs.
- Auditing and allowlists enforced.

## Edge-case checklist

- Command injection attempts.
- Huge payload abuse.
- Methods that bypass policy namespace/profile routing.

# Prompt Templates

Add prompts that orchestrate deterministic tool flows:

- `temporal-triage`
- `temporal-debug-workflow`
- `temporal-docs-answer`
- `temporal-safe-mutation`

Acceptance:

- Prompts consistently execute expected sequence and produce actionable output.

## Edge-case checklist

- Missing tools due to policy/capability restrictions.
- Prompt orchestration on unavailable profile.

# Sampling for LLM-powered Analysis

Use sampling as optional enhancement with deterministic fallback.

Use cases:

- history analysis
- cross-workflow failure pattern correlation
- docs-augmented diagnosis
- visibility query construction from natural language

Acceptance:

- Sampling disabled/unavailable still yields deterministic tool output.
- Payload size and redaction limits always enforced.

## Edge-case checklist

- Host declines sampling request.
- Sampling response times out.
- Truncated context changes model recommendation quality.

# Completions (Spec Track + Extension Track)

## Track A: MCP-Spec Completion (Required)

Implement `completion/complete` for:

- `ref/prompt`
- `ref/resource`

This is the standards-compliant completion surface.

## Track B: Host Extensions (Optional, Non-standard)

Tool-argument suggestions (profile/namespace/workflow IDs/etc.) are explicitly marked host-specific UX extension, not protocol standard behavior. Implement via prompt wrappers or host integration hooks where available.

Acceptance:

- Spec completion works independent of host extensions.
- Extension behavior is clearly documented as non-standard.

## Edge-case checklist

- Host expects generic argument completion and protocol cannot satisfy it.
- Cached suggestions stale after namespace/profile changes.

# Resource Subscriptions for Live Monitoring

Implement subscriptions for workflow/taskQueue/schedule resources with bounded polling.

Acceptance:

- Status changes emit `notifications/resources/updated`.
- Polling respects concurrency and minimum interval.

## Edge-case checklist

- Subscription storm.
- Disconnect/unsubscribe cleanup race.

# Embeddings and Hybrid Docs Search Slice

Post-stability enhancement.

- opt-in embeddings
- lexical top-N + rerank
- provider abstraction
- lexical fallback on failure

Acceptance:

- Misconfigured provider does not break docs search.

## Edge-case checklist

- Embedding provider outage.
- High memory index build on large corpus.

# Operator-grade Reliability and Performance Slice

Add:

- deadlines/timeouts for all Temporal calls
- cancellation propagation
- pagination everywhere list-like
- TTL caches
- memory guards and payload caps
- progress updates every <=2s for long ops

Acceptance:

- Server remains responsive under load.
- Cancellation and timeout behavior deterministic.

## Edge-case checklist

- Response arrives after cancellation.
- Cache stampede.
- Concurrency semaphore starvation.

# Transport Expansion and Deployment Slice (R4)

`R1/R2` default: stdio only.

`R4` adds Streamable HTTP with explicit mode:

## Mode A: OAuth-compliant MCP Authorization

- implement authorization metadata/discovery expectations
- token validation and scope checks
- cross-origin and origin policies

## Mode B: Internal/Local-only

- bind constraints
- explicit warning in docs and startup logs
- non-public deployment guidance

Acceptance:

- Feature parity with stdio.
- Auth mode is explicit and enforced.

## Edge-case checklist

- Misconfigured auth strategy.
- Public bind with internal mode enabled.
- Token expiry mid-stream.

# Packaging Slice

Add:

- `bin` entry (`bunx temporal-mcp`)
- `--config`
- `--print-effective-config`
- Dockerfile

Acceptance:

- Fresh machine install can connect via stdio with documented config.

## Edge-case checklist

- Missing git in container image.
- Missing cert/key path mounts.

# Documentation

Create `documentation/` with:

- getting started
- config reference
- tool catalog by risk
- host setup guides
- policy guide
- resources/prompts
- architecture guide
- contributing guide

Add generated docs pipeline:

- `scripts/generate-config-docs.ts`
- `scripts/generate-tool-docs.ts`

Acceptance:

- New user can install + connect without reading source.
- CI fails on stale generated docs.

## Edge-case checklist

- Generated docs drift from tool registry.
- undocumented experimental tools accidentally shipped as stable.

# CI, Testing, and Release Slice

This section is a release gate, not a best-effort list.

## Required Test Layers

### 1) Protocol Conformance

- initialize + capability negotiation success/failure
- cancellation handling and races
- progress token behavior and monotonicity
- pagination correctness for tools/resources/prompts/tasks lists
- logging level + redaction compliance

### 2) Capability Fallback

- host without sampling
- host without completions
- host without roots
- host without tasks/elicitation

### 3) Temporal Behavior

- high-level SDK path coverage (workflow/schedule/activity basics)
- raw gRPC fallback coverage (versioning rules, deployments, batch, listScheduleMatchingTimes, task queue config)
- cloud/self-hosted routing and expected unauthorized errors

### 4) Safety and Reliability

- idempotency replay protection
- confirmation token expiry/reuse
- URI/path traversal resistance
- codec endpoint SSRF protections
- timeout/cancel under load

## Release Workflow

- lint/test/build gates
- contract/doc generation checks
- version/changelog automation
- publish only changed packages

Acceptance:

- Main branch always produces runnable artifact.
- CI prevents protocol and policy regressions.

# Edge-case and Assumption Register

Track and test these assumptions explicitly:

1. Visibility APIs are eventually consistent.
2. Continue-as-new and retry chains can change run targeting semantics.
3. Operator service is not universally available (especially Cloud paths).
4. Some proto methods are server-version gated.
5. Cancellation races are normal and must be handled safely.
6. Pagination tokens can expire or become invalid.
7. Decoding can be partial and must preserve provenance.

Each release gate (`R1`-`R4`) must map assumptions to concrete tests.

# “Feature-rich” Definition of Done

You are feature-rich only when all checks below are true in practice:

- [ ] MCP protocol conformance passes for lifecycle, utilities, cancellation, progress, pagination, and logging.
- [ ] Capability fallback behavior is validated for missing sampling/completions/roots/tasks/elicitation.
- [ ] Temporal capability matrix is implemented and enforced (backend + availability + stability).
- [ ] Profile routing by `kind` is enforced with structured unsupported errors.
- [ ] Docs corpus sync/index/search/get works offline after initial sync.
- [ ] Payload decoding works for default JSON, codec paths, and partial-fallback scenarios.
- [ ] Read tools cover workflows, schedules, task queues, namespaces, search attributes, cluster info, worker versioning/deployments.
- [ ] Safe-write tools work with policy gates, idempotency keys, cancellation handling, and progress reporting.
- [ ] Destructive/admin tools are gated post-GA with dual-confirm token flow.
- [ ] Batch operations are unsafe+break-glass only and fully auditable.
- [ ] Escape hatches are disabled by default, allowlisted, and audited.
- [ ] Resources/templates are discoverable and large payloads route via resource URIs.
- [ ] Tasks lifecycle is correct (list/get/cancel, TTL, cleanup).
- [ ] Elicitation and roots integration behave correctly when supported and degrade safely when unsupported.
- [ ] Structured logs and audits are redacted and correlated by request ID.
- [ ] Packaging and docs generation workflows are CI-enforced.

# A Practical Shipping Order That Keeps Morale Intact

Implement in this order:

1. Monorepo scaffolding.
2. MCP compliance baseline.
3. Config system (including new `mcp`, `transport`, `security`, `profile.kind` fields).
4. Policy engine.
5. Tool contract + registry metadata.
6. Tasks + Elicitation + Roots integration (experimental, v1).
7. Docs subsystem.
8. Temporal connectivity + profile routing.
9. Payload decode/codec security.
10. Temporal read-only tool suite.
11. Resources/templates.
12. Safety hardening + logging/audit.
13. Safe-write GA tool suite with idempotency/cancellation semantics.
14. Reliability/performance hardening.
15. Packaging + documentation + CI release gates.
16. `R3`: destructive/admin + batch + escape hatches.
17. `R4`: Streamable HTTP with explicit auth mode implementation.

This sequence prevents two failure modes: (a) broad features without protocol/safety guarantees, and (b) overbuilt infrastructure before useful operator workflows exist.

# Multi-Agent Execution Plan

This section is the execution playbook for a 6-agent delivery team and is required for orchestration.

## Summary

Establish a decision-complete orchestration plan for a 6-agent team to deliver `R1` and `R2` to GA (read + safe-write), while preserving `R3` and `R4` as post-GA tracks.

The execution framework covers:

- mission briefs
- agent prompts and context loading
- authoritative task graph
- path ownership rules
- contract freeze + versioning
- shared coding constraints
- verification gates
- decision boundaries
- handoff protocol
- merge/integration strategy
- QA ownership
- environment/tooling constraints

## Public API / Interface / Type Changes (Locked)

### Contract files (source of truth)

- `packages/server/src/contracts/tool-contract.ts`
- `packages/server/src/contracts/error-envelope.ts`
- `packages/server/src/contracts/config.ts`
- `packages/server/src/contracts/version.ts` (`contractsVersion`)

### Config surface (locked)

- `mcp.capabilities.{tasks,elicitation,roots,completions}`
- `transport.{mode,stdio,http}`
- `temporal.profiles.<name>.kind`
- `security.{confirmTokenTtlSec,maxTaskTtlSec,codecAllowlist,idempotencyWindowSec}`

### Freeze rule

- No agent edits `packages/server/src/contracts/**` without an approved contract-change task.
- Any contract change requires:
  1. `contractsVersion` increment.
  2. Migration note in `documentation/architecture.md`.
  3. Regenerated contract/docs tests and downstream notification.

## 1) Mission Brief

### Objective

Deliver a production-grade MCP server for Temporal operations and docs retrieval with policy-gated mutations, protocol-conformant behavior, and release-gated safety controls (`R1` through `R4`). Completion means the server is shippable at `R2` (read + safe-write GA), with post-GA `R3`/`R4` tracks fully specified and testable.

### Architecture context

The system has three primary packages with clear responsibilities:

- `packages/server`: MCP transport/lifecycle, tool/resource/prompt registry, config loading, policy enforcement, observability.
- `packages/temporal`: Temporal connectivity and operation adapters (SDK-first, raw gRPC/Cloud fallbacks).
- `packages/docs`: docs sync/index/search/retrieval.

Architecture references:

- `documentation/architecture.md` (authoritative component relationships; create/update as implementation proceeds)
- This roadmap sections: `MCP Compliance Baseline`, `Tool Contract and Registry Metadata`, `Temporal API Capability Matrix`

### Why this matters

Users get reliable, auditable operational automation for Temporal environments without sacrificing safety controls. Business value comes from faster incident triage, safer mutations, and standardized multi-host MCP integrations.

### Scope boundary

In scope: `R1` and `R2` completion to GA, with detailed `R3` and `R4` implementation plans.
Out of scope for GA: destructive/admin defaults enabled by default, and remote HTTP production rollout without explicit auth-mode selection.

### Unit-level mission briefs

| Unit | Objective | Architecture context | Why this matters | Explicitly out of scope |
| --- | --- | --- | --- | --- |
| `N1` | Build MCP protocol baseline and utility plumbing | `packages/server/src/mcp/**` | Prevents protocol regressions across all later work | Temporal business logic |
| `N2` | Freeze tool/registry contracts | `packages/server/src/contracts/**` | Enables parallel work with stable interfaces | Runtime behavior tuning |
| `N3` | Finalize capability matrix and profile routing | `packages/temporal/src/capability-matrix.ts` | Prevents unsupported calls in cloud/self-hosted contexts | Full feature implementation |
| `N4` | Implement config schema including new execution fields | `packages/server/src/config/**` | Ensures deterministic startup and orchestrator controls | Non-schema runtime optimizations |
| `N5` | Implement policy/security wrappers and error envelope | `packages/server/src/policy/**`, `packages/server/src/security/**` | Enforces safe operation defaults | Non-policy feature additions |
| `N6` | Add tasks, elicitation, roots integration | `packages/server/src/mcp/**` | Supports long-running operations and user disambiguation | Host-specific UI features |
| `N7` | Build docs subsystem | `packages/docs/src/**` | Enables offline Temporal docs assistance | Embeddings/hybrid reranking |
| `N8` | Implement SDK-first Temporal connectivity/read suite | `packages/temporal/src/read.ts` | Delivers immediate operational value | High-risk mutation paths |
| `N9` | Implement raw gRPC/Cloud fallbacks | `packages/temporal/src/grpc.ts`, `packages/temporal/src/cloud.ts` | Closes feature gaps not covered by high-level SDK | Escape hatch execution |
| `N10` | Add resources/templates/subscriptions | `packages/server/src/mcp/resources*.ts` | Handles large outputs and live monitoring | New Temporal APIs |
| `N11` | Implement safe-write GA tools | `packages/temporal/src/write.ts` | Delivers controlled automation with idempotency/cancellation | Destructive/admin paths |
| `N12` | Reliability/performance hardening | `packages/server/src/observability/**`, `packages/temporal/src/**` | Ensures operability under load | New feature families |
| `N13` | CI/release/docs generation gates | `.github/workflows/**`, `scripts/**` | Keeps integration quality enforceable | Product surface expansion |
| `N14` | GA readiness verification | cross-cutting | Final quality gate and release confidence | Post-GA roadmap items |

## 2) Agent Roles & Context Loading

### `A1 Protocol` (MCP lifecycle and capabilities)

- Role name & specialization: `A1 Protocol` - MCP transport/lifecycle/capabilities, completion/resources/prompts/tasks.
- System prompt/persona:

```text
You are the Protocol Engineer. Prioritize protocol correctness, compatibility negotiation, and deterministic server behavior.
Never bypass capability checks. Treat optional client capabilities as potentially absent and implement safe fallback paths.
Prefer explicit typed contracts and conformance tests before feature expansion.
```

- Required reading before execution (in order):
1. `ROADMAP.md` sections: `MCP Compliance Baseline`, `Tool Contract and Registry Metadata`, `Tasks + Elicitation + Roots Integration`, `Completions`.
2. `documentation/architecture.md` (if present; otherwise create from roadmap).
3. `packages/server/src/mcp/server.ts` and `packages/server/src/mcp/tools.ts` (or create stubs).
4. `packages/server/src/contracts/tool-contract.ts` and `packages/server/src/contracts/error-envelope.ts`.
5. Conformance tests in `packages/server/test/protocol/**`.
- Domain knowledge assumptions:
  - Can assume JSON-RPC and MCP primitives.
  - Must verify actual SDK method names and capability negotiation shape in code.

### `A2 Temporal SDK` (high-level Temporal client paths)

- Role name & specialization: `A2 Temporal SDK` - workflow/schedule/activity operations via `@temporalio/client`.
- System prompt/persona:

```text
You are the Temporal SDK Engineer. Prefer high-level SDK clients first and keep API usage idiomatic.
Do not invent unsupported SDK methods. If an operation is missing, document fallback requirement and defer to A3.
Every operation must pass through policy wrappers and typed error mapping.
```

- Required reading before execution (in order):
1. `ROADMAP.md` sections: `Temporal API Capability Matrix`, `Temporal Read-only Tools`, `Safe-write Tools`.
2. `packages/temporal/src/connect.ts`, `packages/temporal/src/read.ts`, `packages/temporal/src/write.ts`.
3. `packages/server/src/policy/enforce.ts`.
4. `packages/server/src/contracts/tool-contract.ts`.
5. Temporal integration tests in `packages/temporal/test/integration/**`.
- Domain knowledge assumptions:
  - Can assume Temporal SDK semantics for known wrappers.
  - Must verify each method exists before implementation.

### `A3 Raw gRPC + Cloud` (fallback and cloud-specific paths)

- Role name & specialization: `A3 Raw gRPC + Cloud` - raw service calls, operator/cloud split, capability routing.
- System prompt/persona:

```text
You are the Fallback/Cloud Engineer. Implement only matrix-approved raw or cloud paths.
Guard every call with availability and profile-kind checks.
Return structured unsupported/unauthorized errors, never silent fallbacks.
```

- Required reading before execution (in order):
1. `ROADMAP.md` sections: `Profile Typing and Routing Rules`, `Temporal API Capability Matrix`.
2. `packages/temporal/src/capability-matrix.ts`.
3. `packages/temporal/src/grpc.ts` and `packages/temporal/src/cloud.ts`.
4. `packages/server/src/contracts/error-envelope.ts`.
5. Cloud/self-hosted routing tests in `packages/temporal/test/routing/**`.
- Domain knowledge assumptions:
  - Can assume gRPC transport concepts.
  - Must verify proto method signatures and cloud compatibility in source imports.

### `A4 Docs + Retrieval` (docs corpus and search tools)

- Role name & specialization: `A4 Docs + Retrieval` - docs sync/index/chunk/search/get and docs resources.
- System prompt/persona:

```text
You are the Docs Retrieval Engineer. Optimize for deterministic indexing and stable retrieval quality.
Never rely on remote calls at query-time after initial sync.
Keep chunking and filtering reproducible and measurable.
```

- Required reading before execution (in order):
1. `ROADMAP.md` sections: `Docs Subsystem Slice`, `Resources and Resource Templates`.
2. `packages/docs/src/sync.ts`, `packages/docs/src/chunk.ts`, `packages/docs/src/search.ts`, `packages/docs/src/index.ts`.
3. `packages/server/src/mcp/resources.docs.ts`.
4. `packages/docs/test/**`.
5. `documentation/resources.md`.
- Domain knowledge assumptions:
  - Can assume markdown/MDX parsing fundamentals.
  - Must verify corpus paths and marker conventions in repository state.

### `A5 Policy + Security` (guardrails and auditability)

- Role name & specialization: `A5 Policy + Security` - policy decisions, redaction, idempotency, dual-confirm framework.
- System prompt/persona:

```text
You are the Safety Engineer. Safety controls are first-class features and cannot be deferred.
All mutating paths must be auditable and enforce policy before execution.
Prefer explicit deny with typed errors over permissive behavior.
```

- Required reading before execution (in order):
1. `ROADMAP.md` sections: `Policy Engine`, `Safety Hardening`, `R3 Destructive`, `R3 Batch`, `R3 Escape Hatches`.
2. `packages/server/src/policy/types.ts`, `packages/server/src/policy/enforce.ts`.
3. `packages/server/src/security/**`.
4. `packages/server/src/observability/audit.ts`.
5. security tests in `packages/server/test/security/**`.
- Domain knowledge assumptions:
  - Can assume common security primitives.
  - Must verify redaction and logging behavior in actual serializers.

### `A6 CI + Release` (quality gates and release ops)

- Role name & specialization: `A6 CI + Release` - pipeline enforcement, generated artifact checks, integration quality.
- System prompt/persona:

```text
You are the Release Engineer. Enforce deterministic builds, tests, and generation checks.
If it is not reproducible in CI, it is not done.
Protect main branch from contract, policy, and conformance regressions.
```

- Required reading before execution (in order):
1. `ROADMAP.md` sections: `CI, Testing, and Release Slice`, `Feature-rich Definition of Done`.
2. `.github/workflows/**`.
3. root `package.json`, `turbo.json`, `bun.lock`.
4. `scripts/generate-config-docs.ts`, `scripts/generate-tool-docs.ts`.
5. `documentation/contributing.md`.
- Domain knowledge assumptions:
  - Can assume CI pipeline fundamentals.
  - Must verify project scripts and command entry points in repository.

## 3) Task Graph

| Task ID | Epic/workstream | Description | Dependencies | Parallel-safe | Outputs | Estimated complexity |
| --- | --- | --- | --- | --- | --- | --- |
| `N1` | `A1 Protocol` | Implement lifecycle/capabilities/utilities baseline | none | no | `packages/server/src/mcp/server.ts`, conformance tests | large |
| `N2` | `A1 Protocol` | Freeze tool and registry contract types | `N1` | no | `packages/server/src/contracts/tool-contract.ts`, `packages/server/src/contracts/error-envelope.ts` | medium |
| `N3` | `A3 Raw gRPC + Cloud` | Finalize capability matrix + routing rules | `N2` | no | `packages/temporal/src/capability-matrix.ts` | medium |
| `N4` | `A5 Policy + Security` | Implement config schema additions and loader behavior | `N2` | yes | `packages/server/src/config/schema.ts`, `packages/server/src/config/load.ts` | medium |
| `N5` | `A5 Policy + Security` | Implement policy wrappers and error envelope enforcement | `N4` | no | `packages/server/src/policy/**`, `packages/server/src/security/**` | medium |
| `N6` | `A1 Protocol` | Add tasks/elicitation/roots integrations | `N5` | yes | `packages/server/src/mcp/tasks.ts`, `packages/server/src/mcp/elicitation.ts`, `packages/server/src/mcp/roots.ts` | medium |
| `N7` | `A4 Docs + Retrieval` | Implement docs sync/index/search/get tooling | `N6` | yes | `packages/docs/src/**`, docs tests | large |
| `N8` | `A2 Temporal SDK` | Implement connectivity + read-only SDK tool suite | `N3` | yes | `packages/temporal/src/connect.ts`, `packages/temporal/src/read.ts` | large |
| `N9` | `A3 Raw gRPC + Cloud` | Implement raw gRPC/cloud fallback handlers | `N3` | yes | `packages/temporal/src/grpc.ts`, `packages/temporal/src/cloud.ts` | large |
| `N10` | `A1 Protocol` | Add resources/templates/subscriptions | `N7`,`N8`,`N9` | no | `packages/server/src/mcp/resources.ts`, `packages/server/src/mcp/subscriptions.ts` | medium |
| `N11` | `A2 Temporal SDK` | Implement safe-write GA tools with idempotency/cancellation | `N8`,`N9`,`N10` | no | `packages/temporal/src/write.ts`, write tests | large |
| `N12` | `A5 Policy + Security` | Reliability/performance hardening and observability integration | `N11` | no | timeout/retry/caching changes across server/temporal | medium |
| `N13` | `A6 CI + Release` | Enforce CI gates, docs generation, release checks | `N12` | no | workflow files, scripts, CI policies | medium |
| `N14` | `A6 CI + Release` | GA readiness verification and release record | `N13` | no | release checklist, validation report | small |

## 4) File & Path Ownership

### Exclusive zones

| Agent | Exclusive zones |
| --- | --- |
| `A1` | `packages/server/src/mcp/**`, `packages/server/test/protocol/**` |
| `A2` | `packages/temporal/src/read.ts`, `packages/temporal/src/write.ts`, `packages/temporal/test/sdk/**` |
| `A3` | `packages/temporal/src/grpc.ts`, `packages/temporal/src/cloud.ts`, `packages/temporal/test/routing/**` |
| `A4` | `packages/docs/src/**`, `packages/docs/test/**` |
| `A5` | `packages/server/src/policy/**`, `packages/server/src/security/**`, `packages/server/test/security/**` |
| `A6` | `.github/workflows/**`, `scripts/**`, `documentation/**` |

### Shared zones and coordination rules

| Shared path | Coordination rule |
| --- | --- |
| `packages/server/src/contracts/tool-contract.ts` | `A1` writes initial contract; all other agents consume only. Changes require escalation. |
| `packages/server/src/config/schema.ts` | `A5` writes base schema; `A1/A2/A3` can append namespaced fields only after review by `A5`. |
| `packages/server/src/mcp/tools.ts` | Append-only registration blocks by namespace prefix (`temporal.*`, `docs.*`, `system.*`). |
| `documentation/tools/*.md` | Generated by `A6`; no manual edits inside generated markers. |
| `ROADMAP.md` | Manual orchestrator updates only; implementation agents treat as read-only. |

### Read-only references

- `ROADMAP.md`
- `documentation/architecture.md`
- `documentation/policy.md`
- `documentation/configuration.md` generated sections

## 5) Interface Contracts

### Contract definitions (authoritative)

`packages/server/src/contracts/tool-contract.ts`:

```ts
export type Risk = 'read' | 'write' | 'destructive' | 'admin';
export type Backend = 'sdk' | 'workflowService' | 'operatorService' | 'cloud' | 'cli';
export type Availability = 'selfHosted' | 'cloud' | 'both';
export type Stability = 'stable' | 'experimental' | 'deprecated';

export interface ToolContract {
  name: string;
  risk: Risk;
  idempotent: boolean;
  supportsCancellation: boolean;
  supportsTasks: boolean;
  implementationBackend: Backend;
  availability: Availability;
  stability: Stability;
}
```

`packages/server/src/contracts/error-envelope.ts`:

```ts
export interface ErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  };
}
```

`packages/server/src/contracts/config.ts`:

```ts
export interface ProfileConfig {
  kind: 'selfHosted' | 'cloud';
  address: string;
  namespace: string;
}
```

### Example usage

```ts
const contract: ToolContract = {
  name: 'temporal.workflow.describe',
  risk: 'read',
  idempotent: true,
  supportsCancellation: true,
  supportsTasks: false,
  implementationBackend: 'sdk',
  availability: 'both',
  stability: 'stable',
};
```

### Freeze rule

Contracts are immutable during an execution wave. If an agent needs a contract change, it must stop and open a contract-change request. No direct edits are allowed outside that process.

### Versioning

Contract changes require:

1. `contractsVersion` bump in `packages/server/src/contracts/version.ts`.
2. Migration/update notes in `documentation/architecture.md`.
3. Regenerated docs and downstream notification in the handoff payload.

## 6) Shared Conventions & Constraints

### Tech stack and versions

- Runtime: Bun `1.3.x`
- Language: TypeScript `5.x`
- MCP SDK: `@modelcontextprotocol/sdk >= 1.2.0`
- Temporal SDK: `@temporalio/client 1.15.x`
- Package manager: Bun
- Task runner: Turborepo

### Coding patterns to follow

- Schema-first input/output validation via Zod (`packages/server/src/config/schema.ts` and tool schemas).
- Strict structured error envelopes for all user-facing failures.
- Policy enforcement before any Temporal side effect.
- Stderr-only logging for stdio transport.

### Coding patterns to avoid

- Direct stdout logging in stdio server.
- Tool handlers that call Temporal APIs without policy checks.
- Ad hoc JSON responses without contract typing.
- Silent fallback from cloud to self-hosted backends.

### Naming conventions

- Files: kebab-case (except existing conventions).
- Types/interfaces: PascalCase.
- Variables/functions: camelCase.
- Tool names: dotted namespace (`temporal.workflow.describe`, `docs.search`).

### Error handling strategy

- Throw typed domain errors internally.
- Map all exposed errors to `ErrorEnvelope`.
- Log structured context with request ID and redacted fields only.

### Import conventions

- Prefer package-boundary imports (`@temporal-mcp/temporal`, `@temporal-mcp/docs`) from server package.
- No circular imports across `server` and `temporal`.
- Barrel exports allowed only for stable public package API, not internal modules.

## 7) Acceptance Criteria & Verification

### Functional criteria by workstream

| Workstream | Functional criteria | Required tests |
| --- | --- | --- |
| `A1` | Protocol lifecycle/capabilities/utilities behave per spec | protocol conformance tests + cancellation/progress tests |
| `A2` | SDK-backed read/write operations succeed with policy gates | unit + Temporal local integration tests |
| `A3` | Fallbacks route correctly for profile kind and capability | routing/compat integration tests |
| `A4` | Docs sync/index/search/get deterministic and offline-ready | unit + corpus fixture integration tests |
| `A5` | Policy, idempotency, redaction, dual-confirm controls enforced | policy/security tests with deny/allow cases |
| `A6` | CI blocks stale contracts/docs and failing suites | CI pipeline tests and dry-run release checks |

### Global quality gates

- Type safety: compile with zero TypeScript errors.
- Lint/format: pass lint and format checks.
- Self-review checklist:
  - No orphaned TODOs without task IDs.
  - No hardcoded secrets.
  - New exports documented.
  - Tests include happy path and at least one error path.

## 8) Agent Decision Boundaries

### Autonomous decisions

- Internal helper decomposition.
- Local naming choices.
- Test assertion structure.
- Non-observable refactors within owned files.

### Constrained decisions

- Dependencies: only pre-approved libraries; new dependency requires orchestrator approval.
- File size: prefer files under 400 LOC; if exceeded, split by domain.
- Public schema changes: prohibited without contract-change process.

### Escalation triggers

- Contract change required.
- Circular dependency introduced.
- Any security control must be weakened to proceed.
- Estimated change exceeds 600 LOC in a single task without prior split.
- Ambiguous cloud/self-hosted behavior not resolved by matrix.

## 9) Handoff Protocol

Each completed or blocked task emits a structured payload.

### Required handoff fields

- Summary (2-3 sentences)
- Files changed with one-line purpose
- Tests written and status
- Known risks/tech debt
- Unresolved blockers
- Next-step context (decisions made, alternatives rejected, deferred edge cases)

### Markdown template

```md
## Handoff: <task-id>
- Summary:
- Files changed:
- Tests written & status:
- Known risks / tech debt:
- Unresolved blockers:
- Next-step context:
```

### JSON template (orchestrator-friendly)

```json
{
  "taskId": "N8",
  "status": "done",
  "summary": "Implemented SDK-first workflow read tools with policy wrappers.",
  "filesChanged": [
    { "path": "packages/temporal/src/read.ts", "description": "Added workflow list/describe/query handlers" }
  ],
  "tests": [
    { "name": "workflow-read.integration.test.ts", "status": "passing" }
  ],
  "risks": [
    "Visibility query eventual consistency may affect count assertions under load"
  ],
  "blockers": [],
  "nextStepContext": {
    "decisions": ["Used SDK list/count APIs where available"],
    "rejectedAlternatives": ["Raw gRPC for list/count in this task"],
    "deferredEdgeCases": ["Large history reverse pagination tuning"]
  }
}
```

## 10) Integration & Merge Strategy

- Branch strategy: one branch per task using `codex/a<id>/<task-id>-<slug>`.
- Integration branches: `integration/r1`, `integration/r2`, `integration/r3`, `integration/r4`.
- Merge order: strict DAG order from Section 3.
- Conflict protocol: orchestrator merges earlier branch first, then re-runs later agent on merged base for shared-zone conflicts.
- Integration validation: full tests + type-check + lint + generated-docs consistency on merged integration branch.

## 11) QA Ownership

| Workstream | Unit tests | Integration tests | Contract/conformance tests | Done gate |
| --- | --- | --- | --- | --- |
| `A1` | owned by `A1` | shared with `A6` for protocol host fixtures | owned by `A1` consumers (`A2`,`A4`) | task done only when conformance passes |
| `A2` | owned by `A2` | owned by `A2` with local Temporal env | owned by `A2` consuming tool contracts | task done only with passing integration |
| `A3` | owned by `A3` | owned by `A3` (routing and fallback) | owned by `A3` consuming capability matrix | task done only with cloud/self-hosted route tests |
| `A4` | owned by `A4` | owned by `A4` (docs pipeline) | owned by `A4` consuming docs contracts | task done only when corpus fixture tests pass |
| `A5` | owned by `A5` | shared security integration with `A2/A3` | owned by `A5` consuming policy contracts | task done only when deny/allow matrix passes |
| `A6` | owned by `A6` for pipeline logic | owned by `A6` for end-to-end CI flows | owned by `A6` for generated artifact checks | task done only when CI is green on merged state |

## 12) Environment & Tooling

### Available tools

- Shell: `bash`/`zsh`
- Package manager/runtime: `bun`
- Test runner: `bun test`
- Type checking: `tsc` or `bunx tsc`
- Lint/format: project lint/format scripts

### Environment variables

- Required runtime vars are loaded from config/env.
- Sensitive vars must be mocked in tests (`TEMPORAL_MCP_BREAKGLASS`, API keys, cert paths).
- No test should depend on production credentials.

### Database/service access

- Primary integration target: local Temporal test environment via `@temporalio/testing`.
- Cloud tests: CI release-branch only with secret-scoped credentials.
- Agents must use mocks/stubs when remote service access is unavailable.

### Context window budget (read priority order)

1. `ROADMAP.md` (this section plus relevant technical slice)
2. `documentation/architecture.md`
3. Owned path files for current task
4. Contract files in `packages/server/src/contracts/**`
5. Existing tests for target subsystem
6. Non-owned modules only as needed for interface verification

### Parallelization and dependency graph (authoritative)

1. `A1`, `A5`, and `A6` complete `N1` before domain tool coding.
2. `A2` and `A4` execute in parallel after `N1`, both blocked on `N2`.
3. `A3` starts fallback/cloud work only after `N3`.
4. No merge of tool handlers before `A6` contract checks pass.
5. `R3` and `R4` can run on dedicated branches but cannot merge before `R2` GA tag.

Graph:

- `N1 -> N2`
- `N2 -> N3`
- `N2 -> N4`
- `N4 -> N5`
- `N5 -> N6`
- `N3 -> N8`
- `N3 -> N9`
- `N6 -> N7`
- `N7 -> N10`
- `N8 -> N10`
- `N9 -> N10`
- `N8 -> N11`
- `N9 -> N11`
- `N10 -> N11`
- `N11 -> N12`
- `N12 -> N13`
- `N13 -> N14`

Critical path: `N1 -> N2 -> N3 -> N8 -> N11 -> N12 -> N13 -> N14`

## Test Cases and Scenarios (Must Exist Before GA)

### Protocol conformance

- initialize and capability negotiation success/failure
- cancellation race handling
- progress token monotonicity
- pagination token correctness/failure paths
- logging level and redaction validation

### Capability fallback

- host without sampling
- host without completions
- host without roots
- host without tasks/elicitation

### Temporal behavior

- SDK path coverage for workflow/schedule/activity basics
- raw gRPC fallback coverage (versioning rules, deployments, batch, schedule matching times, task queue config)
- cloud/self-hosted routing with expected unauthorized responses

### Safety and reliability

- idempotency replay protection
- confirmation token expiry/replay rejection
- URI/path traversal resistance
- codec endpoint SSRF guard checks
- timeout/cancel behavior under load

## Explicit Assumptions and Defaults

1. Team size is fixed at 6 agents.
2. `R2` is the GA target; `R3` and `R4` are post-GA tracks.
3. SDK-first with raw fallback is mandatory.
4. Contracts are frozen during execution waves.
5. Bun-only runtime is accepted for this release train.
6. Orchestrator enforcement exists for branch order, ownership, and merge guards.

# Progress

## Completed

- [x] Monorepo scaffolding (Bun workspaces, `packages/server` + `packages/temporal`, root `tsconfig.json`)
- [x] First runnable MCP server skeleton (`packages/server/src/server.ts`, stdio transport in `src/index.ts`)
- [x] Configuration system — schema with defaults (`packages/server/src/config/schema.ts`), Zod-validated loader with candidate discovery chain (`packages/server/src/config/load.ts`), deep merge of partial overrides
- [x] Configuration contracts — `McpCapabilitiesConfig`, `TransportConfig`, `SecurityConfig`, `TemporalProfileConfig`, `TemporalConfig`, `AppConfigContract` (`packages/server/src/contracts/config.ts`)
- [x] Tool contract and registry metadata types — `Risk`, `ImplementationBackend`, `Availability`, `Stability`, `ToolContract` (`packages/server/src/contracts/tool-contract.ts`)
- [x] Error envelope contracts — `ErrorEnvelope`, `SuccessEnvelope<T>`, `ResultEnvelope<T>` (`packages/server/src/contracts/error-envelope.ts`)
- [x] Contract versioning (`packages/server/src/contracts/version.ts`, `contractsVersion = 1`)
- [x] Profile routing — `TemporalConnectionManager` with self-hosted and cloud (API key) support, lazy client caching, structured error envelopes for missing/invalid profiles (`packages/temporal/src/connection.ts`)
- [x] Temporal read-only tools — `temporal.workflow.list` with query filter and page size (`packages/temporal/src/tools/workflow-list.ts`), `temporal.workflow.describe` with full execution metadata (`packages/temporal/src/tools/workflow-describe.ts`)
- [x] Tool registration with error wrapping — handler callbacks with success/error envelope formatting, `ErrorEnvelope` passthrough, `INTERNAL_ERROR` wrapping for untyped errors (`packages/server/src/tools/register.ts`)
- [x] GitHub Actions CI pipeline — Bun setup, frozen lockfile install, typecheck, test with coverage (`.github/workflows/ci.yml`)
- [x] Architecture documentation (`documentation/architecture.md`)
- [x] Contributing guide (`documentation/contributing.md`)
- [x] Unit tests for `listWorkflows` — empty results, pagination truncation, query passthrough, `closeTime` mapping, `status.name` conversion (`packages/temporal/test/workflow-list.test.ts`)
- [x] Unit tests for `describeWorkflow` — full description, argument passthrough, null handling for `closeTime`/`executionTime`/`parentExecution`, defaults for `memo`/`searchAttributes` (`packages/temporal/test/workflow-describe.test.ts`)
- [x] Unit tests for `TemporalConnectionManager` — profile resolution, error cases (`packages/temporal/test/connection.test.ts`)
- [x] Handler behavior tests for `register.ts` — success envelopes, error envelope forwarding, `INTERNAL_ERROR` wrapping, non-Error wrapping, profile passthrough (`packages/server/test/tools/register.test.ts`)
- [x] End-to-end stdio smoke test — initialization handshake, `tools/list`, `temporal.workflow.list` call, `temporal.workflow.describe` error case (`packages/server/test/tools/smoke.test.ts`)
- [x] Contract compliance tests — config, error envelope, tool contract, version, barrel exports (`packages/server/test/contracts/`)
- [x] Configuration tests — loader behavior, schema defaults (`packages/server/test/config/`)
- [x] Server factory test (`packages/server/test/server.test.ts`)
- [x] Server capabilities — `createServer` accepts `AppConfigContract`, sets `tools.listChanged`, `logging`, conditional `roots`, and server instructions (`packages/server/src/server.ts`)
- [x] MCP logging wrapper — `McpLogger` class wrapping `server.sendLoggingMessage()` with stderr fallback (`packages/server/src/logging.ts`)
- [x] Policy engine — `PolicyConfig` types, `evaluatePolicy()` pure function, `matchesPattern()` glob matching, `ToolRegistry` class (`packages/server/src/policy/`, `packages/server/src/contracts/policy.ts`, `packages/server/src/tools/registry.ts`)
- [x] Capability matrix — static `TOOL_CONTRACTS` map for all 27 R1 tools, `assertToolAvailable()` with profile-kind routing guards (`packages/temporal/src/capability-matrix.ts`)
- [x] Raw gRPC helpers — 13 typed wrappers for `workflowService`/`operatorService` proto calls (`packages/temporal/src/grpc.ts`)
- [x] Cloud API stubs — placeholder error envelopes for unimplemented cloud operations (`packages/temporal/src/cloud.ts`)
- [x] Docs subsystem — `@temporal-mcp/docs` package with sync, SDK detection, heading-aware chunking, MiniSearch indexing, status/search/get/refresh tools (`packages/docs/`)
- [x] Workflow tools — `count`, `result`, `query`, `history`, `history.reverse`, `history.summarize` (`packages/temporal/src/tools/workflow/`)
- [x] Schedule tools — `list`, `describe`, `matching-times` (`packages/temporal/src/tools/schedule/`)
- [x] Infrastructure tools — task queue describe/config, namespace list/describe, search attributes list, cluster info (`packages/temporal/src/tools/infrastructure/`)
- [x] Worker tools — versioning rules, task reachability, deployment list/describe/version/reachability (`packages/temporal/src/tools/worker/`)
- [x] Connection check tool — `checkConnection()` via `getSystemInfo` (`packages/temporal/src/tools/connection-check.ts`)
- [x] Safety hardening — `RequestContext`, `AuditLogger`, `redactSensitiveFields()` (`packages/server/src/safety/`)
- [x] Response helpers — extracted `errorResponse()`, `successResponse()`, `isErrorEnvelope()` (`packages/server/src/tools/response-helpers.ts`)
- [x] Tool registration refactor — family-based registration with policy guard + audit pipeline (`packages/server/src/tools/register-all.ts`, `register-workflow.ts`, `register-schedule.ts`, `register-infrastructure.ts`, `register-worker.ts`, `register-connection.ts`, `register-docs.ts`)
- [x] Resource templates — workflow, schedule, task queue, namespace, docs URI templates (`packages/server/src/resources/`)
- [x] Inline threshold — 32KB threshold check for large responses with summary + URI fallback (`packages/server/src/resources/inline-threshold.ts`)
- [x] Elicitation — `requestConfirmation()` with capability detection and graceful degradation (`packages/server/src/elicitation/confirmation.ts`)
- [x] Roots discovery — `RootsDiscovery` class with listener pattern and cache invalidation (`packages/server/src/roots/discovery.ts`)
- [x] Payload decoder — 3-stage pipeline (JSON → remote codec → fallback), SSRF protection, codec allowlist (`packages/temporal/src/payload-decoder.ts`)
- [x] Profile configuration access — `getProfileConfiguration()` on `TemporalConnectionManager` (`packages/temporal/src/connection.ts`)

## Remaining

### R1 Foundation

- [x] MCP protocol lifecycle — `initialize` handshake validation, protocol version negotiation, capability negotiation, graceful shutdown (SDK handles lifecycle; `createServer` now passes capabilities and instructions)
- [x] MCP required utilities — `ping`, cancellation (`notifications/cancelled`), progress (`notifications/progress`), pagination semantics, structured logging (`notifications/message`) (SDK handles ping/cancel/progress; `McpLogger` wraps `sendLoggingMessage` for structured audit/policy/connection events)
- [x] Dynamic list notifications — `notifications/tools/list_changed`, `notifications/resources/list_changed`, `notifications/prompts/list_changed` (SDK handles automatically; `listChanged: true` configured in server capabilities)
- [ ] Protocol conformance test suite (`packages/server/test/protocol/`)
- [x] Capability matrix implementation — backend classification, availability assertions, profile-kind routing guards (`packages/temporal/src/capability-matrix.ts`)
- [x] Policy engine — risk gating by mode (`readOnly`, `safeWrite`, `custom`, `unsafe`), `hardReadOnly` override, profile/namespace allowlists, allow/deny tool patterns, break-glass, structured policy errors (`packages/server/src/policy/`)
- [ ] Tasks integration — `tasks/list`, `tasks/get`, `tasks/cancel` with TTL and cancellation (`packages/server/src/mcp/tasks.ts`)
- [x] Elicitation integration — `elicitation/create` for high-risk confirmations, graceful degradation when host lacks capability (`packages/server/src/elicitation/confirmation.ts`)
- [x] Roots integration — `roots/list` scanning boundary, `notifications/roots/list_changed` cache invalidation (`packages/server/src/roots/discovery.ts`)
- [x] Docs subsystem — corpus sync, SDK detection and filtering, heading-aware chunking, MiniSearch indexing (`packages/docs/`)
- [x] Docs MCP tools — `docs.status`, `docs.search`, `docs.get`, `docs.refresh`
- [x] Remaining read-only Temporal tools — `temporal.workflow.count`, `temporal.workflow.result`, `temporal.workflow.query`, `temporal.workflow.history`, `temporal.workflow.history.reverse`, `temporal.workflow.history.summarize`
- [x] Schedule read tools — `temporal.schedule.list`, `temporal.schedule.describe`, `temporal.schedule.matching-times`
- [x] Infrastructure and metadata read tools — `temporal.task-queue.describe`, `temporal.task-queue.configuration`, `temporal.namespace.list`, `temporal.namespace.describe`, `temporal.search-attributes.list`, `temporal.cluster.info`
- [x] Worker versioning and deployment read tools — `temporal.worker.versioning-rules`, `temporal.worker.task-reachability`, `temporal.worker.deployment.list`, `temporal.worker.deployment.describe`, `temporal.worker.deployment.version.describe`, `temporal.worker.deployment.reachability`
- [x] Payload decoding and codec support — default JSON converter, optional remote codec, graceful undecoded fallback, `security.codecAllowlist`, SSRF protection (`packages/temporal/src/payload-decoder.ts`)
- [x] Resources and resource templates — workflow, schedule, task queue, namespace, docs resource templates, inline threshold handling (`packages/server/src/resources/`)
- [x] Safety hardening — request IDs, structured audit logs, redaction filters, `notifications/message` for policy/audit/connection events (`packages/server/src/safety/`)
- [x] Temporal connectivity check tool — `temporal.connection.check`
- [x] Raw gRPC and cloud fallback handlers (`packages/temporal/src/grpc.ts`, `packages/temporal/src/cloud.ts`)

### R2 GA

- [ ] Safe-write workflow tools — `temporal.workflow.start`, `temporal.workflow.execute`, `temporal.workflow.signal`, `temporal.workflow.signalWithStart`, `temporal.workflow.update`, `temporal.workflow.updateWithStart`
- [ ] Safe-write schedule tools — `temporal.schedule.create`, `temporal.schedule.update`, `temporal.schedule.trigger`, `temporal.schedule.backfill`
- [ ] Safe-write activity tools — `temporal.activity.complete`, `temporal.activity.fail`, `temporal.activity.heartbeat`, `temporal.activity.reportCancellation`, `temporal.activity.updateOptions`, `temporal.activity.reset`
- [ ] Safe-write infrastructure tools — `temporal.searchAttributes.add`, `temporal.taskQueue.config.set`
- [ ] Safe-write worker versioning tools — `temporal.worker.versioningRules.insert`, `temporal.worker.versioningRules.replace`, `temporal.worker.versioningRules.addRedirect`, `temporal.worker.versioningRules.replaceRedirect`, `temporal.worker.versioningRules.commitBuildId`
- [ ] Safe-write deployment tools — `temporal.worker.deployment.setCurrentVersion`, `temporal.worker.deployment.setRampingVersion`, `temporal.worker.deployment.updateMetadata`
- [ ] Idempotency key support for write paths
- [ ] Cancellation-aware handlers for long-running operations
- [ ] Progress token support for operations exceeding host timeouts
- [ ] Operator-grade reliability — deadlines/timeouts for all Temporal calls, cancellation propagation, TTL caches, memory guards, payload caps, progress updates every 2 seconds or less
- [ ] Prompt templates — `temporal-triage`, `temporal-debug-workflow`, `temporal-docs-answer`, `temporal-safe-mutation`
- [ ] Completions — `completion/complete` for `ref/prompt` and `ref/resource`
- [ ] Resource subscriptions for live monitoring — workflow, task queue, schedule with bounded polling
- [ ] Packaging — `bin` entry (`bunx temporal-mcp`), `--config`, `--print-effective-config`, Dockerfile
- [ ] Documentation generation — `scripts/generate-config-docs.ts`, `scripts/generate-tool-docs.ts`
- [ ] Full documentation set — getting started, config reference, tool catalog by risk, host setup guides, policy guide, resources/prompts, contributing guide
- [ ] GA release gates — protocol conformance tests pass, read and safe-write tool suites pass against local Temporal integration, cloud/self-hosted routing validated, policy bypass regressions blocked in CI

### R3 Post-GA

- [ ] Destructive workflow tools — `temporal.workflow.cancel`, `temporal.workflow.terminate`, `temporal.workflow.reset`, `temporal.workflow.delete`, `temporal.workflow.pause`, `temporal.workflow.unpause`
- [ ] Destructive activity tools — `temporal.activity.pause`, `temporal.activity.unpause`
- [ ] Destructive schedule tools — `temporal.schedule.pause`, `temporal.schedule.unpause`, `temporal.schedule.delete`
- [ ] Destructive infrastructure tools — `temporal.searchAttributes.remove`
- [ ] Destructive versioning and deployment tools — delete assignment, redirect, deployments, versions
- [ ] Dual-confirm contract — preview phase with `confirmationToken` and affected summary, execute phase with token and reason, one-time-use tokens with TTL
- [ ] Batch operations — `temporal.batch.list`, `temporal.batch.describe`, `temporal.batch.terminate`, `temporal.batch.cancel`, `temporal.batch.signal`, `temporal.batch.reset`, `temporal.batch.delete`
- [ ] Raw gRPC escape hatch — `temporal.grpc.call` with method allowlist, payload limits, full audit
- [ ] CLI passthrough — `temporal.cli.exec` with command allowlist, JSON output requirement

### R4 Remote Deployments

- [ ] Streamable HTTP transport with explicit auth mode decision
- [ ] Mode A: OAuth-compliant MCP authorization — discovery, token validation, scope checks, cross-origin policies
- [ ] Mode B: Internal/local-only — bind constraints, explicit warnings, non-public deployment guidance
- [ ] Sampling for LLM-powered analysis — history analysis, cross-workflow failure correlation, docs-augmented diagnosis, visibility query construction
- [ ] Embeddings and hybrid docs search — opt-in embeddings, lexical top-N plus rerank, provider abstraction, lexical fallback

# Reference Sources

- [MCP docs index](https://modelcontextprotocol.io/llms.txt)
- [MCP Spec 2025-11-25 Overview](https://modelcontextprotocol.io/specification/2025-11-25/basic)
- [MCP Lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [MCP Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP Completion](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/completion)
- [MCP Pagination](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/pagination)
- [MCP Logging](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/logging)
- [MCP Cancellation](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation)
- [MCP Tasks](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)
- [MCP Elicitation](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)
- [MCP Roots](https://modelcontextprotocol.io/specification/2025-11-25/client/roots)
- [MCP Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [Temporal TS `Connection` API](https://typescript.temporal.io/api/classes/client.Connection)
- [Temporal TS `WorkflowClient` API](https://typescript.temporal.io/api/classes/client.WorkflowClient)
- [Temporal TS `ScheduleClient` API](https://typescript.temporal.io/api/classes/client.ScheduleClient)
- [Temporal TS `TaskQueueClient` API](https://typescript.temporal.io/api/classes/client.TaskQueueClient)
- [Temporal TS `AsyncCompletionClient` API](https://typescript.temporal.io/api/classes/client.AsyncCompletionClient)
