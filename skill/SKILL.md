---
name: temporal-mcp
description: >
  Use this skill when the user asks to create, debug, or operate Temporal
  workflows, activities, or workers. Triggers include: "create a Temporal
  workflow", "write a Temporal activity", "debug stuck workflow", "fix
  non-determinism error", "workflow replay", "activity timeout", "signal
  workflow", "query workflow", "worker not starting", "activity keeps
  retrying", "Temporal heartbeat", "continue-as-new", "child workflow",
  "saga pattern", "workflow versioning", "durable execution", "inspect
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

## Core Architecture

```
┌─────────────────────────────────┐
│         Temporal Cluster        │
│  Frontend · History · Matching  │
└──────────────┬──────────────────┘
               │ Task Queues
         ┌─────▼──────┐
         │   Workers  │
         │ Workflows  │
         │ Activities │
         └────────────┘
               ▲
    ┌──────────┴──────────┐
    │  temporal-mcp (MCP) │
    │   read-only observer│
    └─────────────────────┘
```

The Temporal Cluster persists event history and schedules tasks onto named Task Queues. Workers long-poll those queues to pick up Workflow Tasks and Activity Tasks, then execute the corresponding workflow function or activity function. The `temporal-mcp` MCP server connects to the cluster's Frontend service via gRPC and exposes inspection tools — it observes but never mutates workflow state (with the exception of triggering schedules, which is a limited write operation).

---

## History Replay: Why Determinism Matters

Temporal rebuilds workflow state by re-executing the workflow function against its recorded event history every time a worker picks up a Workflow Task. The SDK replays past commands without re-executing the underlying work (activities, timers), then resumes at the point where new work needs to happen. Every execution of the workflow function must produce the exact same sequence of commands for the same history — this is the determinism contract. Non-deterministic code (random numbers, wall-clock time, direct I/O, non-deterministic iteration order) causes replay to produce a different sequence of commands than what was recorded, which the SDK detects and surfaces as a non-determinism error, crashing the workflow. See `references/core/determinism.md` for the full breakdown of what breaks replay and how to fix it.

---

## Getting Started

### For Development

Detect the user's language, then load the appropriate getting-started reference first:

- TypeScript → `references/typescript/typescript.md`
- Python → `references/python/python.md`
- Go → `references/go/go.md`

Then load relevant `references/core/` files as the conversation requires (determinism, patterns, gotchas, versioning, troubleshooting, error-reference, operational-patterns).

### For Operations

Install the MCP server:

```sh
npx -y temporal-mcp
```

It connects to your Temporal cluster (defaults to `localhost:7233`) and exposes 28 read-only tools for live inspection. Configure the connection via environment variables or a `~/.temporal-mcp.json` profile file. See **MCP Tools Available** below for the full tool inventory.

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
