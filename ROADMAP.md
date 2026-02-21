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
