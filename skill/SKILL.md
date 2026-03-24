---
name: temporal-mcp
description: >
  Use this skill when the user asks to create, debug, or operate Temporal
  workflows, activities, or workers. Triggers include: "create a Temporal
  workflow", "write a Temporal activity", "debug stuck workflow", "fix
  non-determinism error", "workflow replay", "activity timeout", "signal
  workflow", "query workflow", "worker not starting", "activity keeps
  retrying", "Temporal heartbeat", "continue-as-new", "child workflow",
  "saga pattern", "workflow versioning", "inspect
  workflow history", "check task queue", "describe namespace", "list
  schedules", "worker deployment", "Temporal Cloud", "temporal CLI",
  or mentions Temporal SDK development or Temporal cluster operations.
license: MIT
metadata:
  author: stevekinney
  version: "0.1.0"
---

## Overview

This skill provides curated Temporal development knowledge through a set of reference files covering determinism, patterns, gotchas, versioning, troubleshooting, error handling, and language-specific guidance for TypeScript, Python, and Go. The knowledge layer is standalone and useful without any running infrastructure. Alongside it, the `temporal-mcp` MCP server connects to a live Temporal cluster and exposes 28 read-only tools for inspecting workflow state, task queues, schedules, namespaces, and worker deployments in real time. The two layers are synergistic: references explain what the code should do, and the MCP tools reveal what is actually happening in production.

---

## How temporal-mcp Fits

The `temporal-mcp` MCP server connects to the Temporal cluster's Frontend gRPC service as a read-only observer. It can inspect workflows, task queues, schedules, namespaces, and worker deployments, but it never starts, signals, cancels, or terminates workflows (the one exception: triggering an already-configured schedule). All mutation happens through your application's Temporal client and workers.

---

## History Replay: Why Determinism Matters

Temporal rebuilds workflow state by re-executing the workflow function against its recorded event history every time a worker picks up a Workflow Task. The SDK replays past commands without re-executing the underlying work (activities, timers), then resumes at the point where new work needs to happen. Every execution of the workflow function must produce the exact same sequence of commands for the same history — this is the determinism contract. Non-deterministic code (random numbers, wall-clock time, direct I/O, non-deterministic iteration order) causes replay to produce a different sequence of commands than what was recorded, which the SDK detects and surfaces as a non-determinism error, crashing the workflow. See `references/core/determinism.md` for the full breakdown of what breaks replay and how to fix it.

---

## Rules That Prevent the Most Bugs

These rules apply to ALL code inside a workflow function. Violating any of them causes non-determinism errors that crash running workflows.

- NEVER use `Date.now()`, `datetime.now()`, or `time.Now()` in workflow code. Use `workflow.currentTimeMillis()` (TypeScript), `workflow.now()` (Python), or `workflow.Now(ctx)` (Go).
- NEVER use `Math.random()`, `random.random()`, or `rand` in workflow code. Use the SDK's `workflow.random()` equivalent.
- NEVER use `setTimeout` / `time.sleep()` / `asyncio.sleep()` in workflow code. Use `workflow.sleep()` (TypeScript/Python) or `workflow.Sleep(ctx, duration)` (Go).
- NEVER make network calls, read files, or access databases directly in workflow code. Put all I/O in activities.
- NEVER iterate Go maps in workflow code without sorting keys first. Map iteration order is randomized.
- NEVER use `go func()` in workflow code. Use `workflow.Go(ctx, func(...))`.
- NEVER catch and swallow `CancelledError` / `CancelledFailure`. Always re-throw cancellation errors or the replay command sequence will diverge.
- NEVER deploy changed workflow code without a `patched()` / `GetVersion` guard if workflows are still running with the old code. Changed code + old history = non-determinism crash. Read `references/core/versioning.md` BEFORE modifying any workflow that has running executions.
- NEVER omit both `scheduleToCloseTimeout` and `startToCloseTimeout` on an activity. Activities retry forever by default — without a timeout, a permanently failing activity blocks the workflow indefinitely.
- NEVER skip `heartbeat()` calls in activities running longer than 30 seconds. Without heartbeats, Temporal cannot detect a stuck or crashed activity until the full `startToCloseTimeout` expires.

See `references/core/determinism.md` and `references/core/gotchas.md` for detailed explanations and code examples.

---

## Getting Started

### For Development

Detect the user's SDK by inspecting project files:

- **TypeScript**: `package.json` contains a dependency starting with `@temporalio/` → load `references/typescript/typescript.md`
- **Python**: `requirements.txt` or `pyproject.toml` contains `temporalio` → load `references/python/python.md`
- **Go**: `go.mod` contains `go.temporal.io` → load `references/go/go.md`

If the language is ambiguous, ask the user.

Then load core references based on the problem:

| Problem | Load |
|---------|------|
| Writing new workflow or activity code | `references/core/patterns.md` + `references/{language}/patterns.md` |
| Debugging non-determinism or replay errors | `references/core/determinism.md` + `references/{language}/versioning.md` |
| Activity retrying, timing out, or stuck | `references/core/gotchas.md` |
| Understanding an error message | `references/core/error-reference.md` |
| Workflow stuck, failed, or timed out | `references/core/troubleshooting.md` |
| Reading MCP tool output or cluster state | `references/core/operational-patterns.md` |
| Deploying changed code to production | `references/core/versioning.md` + `references/{language}/versioning.md` |
| Creating or debugging schedules | `references/core/schedules.md` |

### For Operations

Install the MCP server:

```sh
npx -y temporal-mcp
```

It connects to your Temporal cluster (defaults to `localhost:7233`) and exposes 28 read-only tools for live inspection. Configure the connection via environment variables or a `~/.temporal-mcp.json` profile file. See **MCP Tools Available** below for the full tool inventory.

---

## Scope

This skill provides reference files and code examples for three Temporal SDKs:

- **TypeScript** (`@temporalio/*` packages)
- **Python** (`temporalio` package)
- **Go** (`go.temporal.io/sdk`)

The following Temporal SDKs exist but are **not covered** by this skill's reference files: **Java**, **.NET**, **Ruby**, **PHP**. If the user is working with one of these SDKs, state clearly that this skill does not have language-specific guidance for their SDK and suggest consulting the official Temporal documentation at https://docs.temporal.io.

The core concepts (determinism, replay, versioning strategies, error taxonomy) apply to all Temporal SDKs regardless of language. The MCP cluster-inspection tools also work regardless of SDK language.

**Not covered**: Temporal Cloud account management, billing, namespace provisioning via the Temporal Cloud UI/API, Nexus (cross-namespace service orchestration), and Temporal Web UI configuration.

---

## Primary References

| File | Description |
|------|-------------|
| `references/core/determinism.md` | Replay mechanics, determinism rules, what breaks replay |
| `references/core/patterns.md` | Saga, fan-out/fan-in, child workflows, signals/queries |
| `references/core/gotchas.md` | Common mistakes: timeouts, retries, heartbeating, side effects |
| `references/core/versioning.md` | Workflow versioning strategies for safe code evolution |
| `references/core/troubleshooting.md` | Diagnostic decision trees for stuck/failed workflows |
| `references/core/error-reference.md` | Error taxonomy: ApplicationFailure, CancelledFailure, TimeoutFailure, etc. |
| `references/core/operational-patterns.md` | Reading event histories, cluster health indicators, correlating tool output with code |
| `references/core/schedules.md` | Creating and configuring schedules: specs, overlap policies, backfill |
| `references/typescript/typescript.md` | TypeScript SDK setup, project structure, worker bootstrap |
| `references/typescript/determinism.md` | TypeScript-specific determinism hazards (Promise ordering, date-fns, etc.) |
| `references/typescript/patterns.md` | TypeScript workflow/activity implementation patterns |
| `references/typescript/gotchas.md` | TypeScript-specific gotchas: bundling, module resolution, type errors |
| `references/typescript/versioning.md` | TypeScript workflow versioning with `patched()` / `deprecatePatch()` |
| `references/python/python.md` | Python SDK setup, asyncio model, worker bootstrap |
| `references/python/determinism.md` | Python-specific determinism hazards (async iteration, datetime.now, etc.) |
| `references/python/patterns.md` | Python workflow/activity implementation patterns |
| `references/python/gotchas.md` | Python-specific gotchas: async activity heartbeat, sandbox restrictions |
| `references/python/versioning.md` | Python workflow versioning with `workflow.patched()` / `workflow.deprecate_patch()` |
| `references/go/go.md` | Go SDK setup, worker bootstrap, context propagation |
| `references/go/determinism.md` | Go-specific determinism hazards (map iteration, goroutines, etc.) |
| `references/go/patterns.md` | Go workflow/activity implementation patterns |
| `references/go/gotchas.md` | Go-specific gotchas: activity context, panic handling |
| `references/go/versioning.md` | Go workflow versioning with `workflow.GetVersion()` |

---

## MCP Tools Available

### Workflow (`temporal.workflow.*`)

List workflows, describe a specific workflow execution, fetch full event history, summarize history into a human-readable digest, count workflows by filter, send a signal to a running workflow, and query a workflow's current state.

### Schedule (`temporal.schedule.*`)

List schedules, describe a specific schedule (including next action times and recent actions), and trigger a schedule run immediately (limited write operation).

### Infrastructure (`temporal.namespace.*`, `temporal.cluster.*`)

Describe a specific namespace (retention, search attributes, replication), list all namespaces, retrieve cluster info, and retrieve system info (server version, capabilities).

### Worker (`temporal.task-queue.*`, `temporal.worker-deployment.*`)

Describe a task queue (poller list, backlog count hint, versioning info), list active pollers on a task queue, and retrieve worker deployment information including build IDs.

### Connection (`temporal.connection.*`)

Check connectivity to the configured Temporal cluster endpoint, and list configured connection profiles.

### Documentation (`docs.*`)

Full-text search of the Temporal documentation corpus, retrieve individual documentation pages by path, and refresh the local documentation index.

---

## Diagnostic Workflows

### 1. Workflow stuck or not progressing

1. Read `references/core/troubleshooting.md` for the full decision tree.
2. Call `temporal.workflow.describe` — check `status`, `pendingActivities`, and `pendingChildWorkflowExecutions`.
3. If there are pending activities: call `temporal.task-queue.describe` on the task queue those activities are targeting.
4. If `pollers` is empty or missing: workers are down or the task queue name in the worker registration does not match the task queue name in the workflow code.
5. Call `temporal.workflow.history.summarize` to see the last few events and confirm where the workflow is blocked.

### 2. Non-determinism error (`nondeterministic` in error message)

1. Read `references/core/determinism.md` to understand what category of change broke replay.
2. Read `references/{language}/versioning.md` for the appropriate migration strategy using patches or build IDs.
3. Call `temporal.workflow.history` to retrieve the full event sequence for the failing workflow execution.
4. Find the event where replay diverged: look for a `ScheduleActivity`, `StartTimer`, or `MarkerRecorded` event whose attributes differ from what the current code would produce at that point in the sequence.

### 3. Activity keeps retrying

1. Read `references/core/gotchas.md` (retry policy and heartbeat sections).
2. Call `temporal.workflow.describe` — inspect `pendingActivities[].lastFailure` for the error message and `pendingActivities[].attempt` for the retry count.
3. Call `temporal.task-queue.describe` to verify that pollers exist for the task queue the activity is scheduled on.
4. If the activity is long-running and `lastFailure` mentions a heartbeat timeout, the activity is not calling `heartbeat()` frequently enough — check the activity implementation and compare against the configured `heartbeatTimeout`.
