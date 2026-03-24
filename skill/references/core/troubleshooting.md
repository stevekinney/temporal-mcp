# Temporal Troubleshooting Guide

---

## Workflow Status Reference

| Status | Operational Meaning |
|--------|---------------------|
| `RUNNING` | The workflow is active and waiting for the next Workflow Task or activity result. This is the normal state for workflows that have work in progress. |
| `COMPLETED` | The workflow function returned successfully. The final return value is in the event history. |
| `FAILED` | An unhandled exception propagated to the root of the workflow function. The error message is stored in the history. |
| `TIMED_OUT` | The `workflowExecutionTimeout` or `workflowRunTimeout` expired before the workflow completed. |
| `CANCELED` | The workflow received a cancellation request, and either handled it cleanly (caught `CancelledError` and returned) or timed out waiting for cancellation handling. |
| `TERMINATED` | The workflow was forcefully killed via `terminate` API with no cleanup. Activities that were running may have completed on the worker side — Temporal does not know. |
| `CONTINUED_AS_NEW` | The workflow called `continueAsNew`. This is not a failure — the new run is a separate workflow execution with the same workflow ID. |

---

## Decision Trees

### Workflow Won't Start

```
Workflow won't start (client.start() throws or times out)
│
├── Error: "namespace not found"
│   └── Namespace does not exist. Check spelling. Create with temporal namespace create.
│
├── Error: "workflow execution already started"
│   └── WorkflowIdReusePolicy is blocking a new start.
│       Check the policy in your start options.
│
├── Error: "connection refused" / gRPC unavailable
│   └── Worker cannot reach the Temporal Frontend service.
│       Check TEMPORAL_ADDRESS env var and network/firewall.
│
├── Workflow starts but never picks up work (stuck in RUNNING, no events after WorkflowExecutionStarted)
│   └── No worker is polling the task queue.
│       → temporal.task-queue.describe → check pollers array.
│       → If empty: start a worker, check task queue name matches.
│
└── Workflow starts and immediately FAILED
    └── temporal.workflow.describe → read the failure message.
        Common causes: input deserialization error, panic at workflow start.
```

### Workflow Stuck in RUNNING

```
Workflow stuck in RUNNING, no progress
│
├── Call temporal.workflow.describe
│   ├── pendingActivities is non-empty
│   │   ├── Check pendingActivities[].taskQueue name
│   │   └── Call temporal.task-queue.describe on that task queue
│   │       ├── pollers is empty → workers are down or task queue name mismatch
│   │       └── pollers exist → activity is running but slow; check heartbeat + startToCloseTimeout
│   │
│   ├── pendingChildWorkflowExecutions is non-empty
│   │   └── Investigate the child workflow ID with temporal.workflow.describe
│   │
│   └── No pending activities or children
│       └── Workflow is waiting on a signal, a condition, or a timer
│           → Call temporal.workflow.history.summarize to see the last events
│           → If TimerStarted with no TimerFired: workflow is sleeping / waiting for a deadline
│           → If WorkflowExecutionSignaled missing: workflow is blocked waiting for a signal
│
└── Call temporal.workflow.history.summarize
    └── Read the last event type to understand where the workflow is blocked
```

**MCP tools to use**:
- `temporal.workflow.describe` — primary diagnostic tool
- `temporal.task-queue.describe` — check poller health
- `temporal.workflow.history.summarize` — human-readable history digest

### Activity Keeps Retrying

```
Activity is retrying repeatedly
│
├── Call temporal.workflow.describe
│   └── pendingActivities[0].lastFailure.message — read the error
│       ├── "connection refused" / network error → external dependency is down
│       ├── "permission denied" → credentials or IAM issue
│       ├── "context deadline exceeded" → startToCloseTimeout too short
│       └── heartbeat timeout → activity is not calling heartbeat() frequently enough
│
├── Check pendingActivities[0].attempt
│   └── Very high attempt count (>10) → activity is stuck in a retry loop
│       Consider: is this error retryable? Should it be non-retryable?
│
├── Call temporal.task-queue.describe
│   └── pollers empty → no workers picking up the activity
│
└── Check retry policy
    └── maximumAttempts unlimited + non-transient error → add nonRetryableErrorTypes
        or throw ApplicationFailure.nonRetryable in the activity
```

**MCP tools to use**:
- `temporal.workflow.describe` — read `pendingActivities[].lastFailure` and attempt count
- `temporal.task-queue.describe` — verify pollers

### Workflow FAILED

```
Workflow in FAILED status
│
├── Call temporal.workflow.describe → read failure.message
│
├── Is the error "ApplicationFailure"?
│   ├── nonRetryable=true → intentional failure from user code; check the type field
│   └── nonRetryable=false → workflow retry policy allowed it to fail after max retries
│
├── Is the error "TimeoutFailure"?
│   └── See "Workflow TIMED_OUT" below
│
├── Is the error related to "non-determinism" or "nondeterministic"?
│   └── See determinism.md and versioning.md
│
└── Call temporal.workflow.history to read the final WorkflowExecutionFailed event
    └── The event contains the full failure chain including cause chain
```

### Workflow TIMED_OUT

```
Workflow in TIMED_OUT status
│
├── The workflowExecutionTimeout expired
│   └── Increase workflowExecutionTimeout in the start options, or
│       check if the workflow is faster now (maybe a past bug caused slowness)
│
├── The workflowRunTimeout expired
│   └── Each "run" (between continue-as-new calls) has a run timeout.
│       Adjust workflowRunTimeout or ensure continue-as-new fires more frequently.
│
└── Was this expected?
    └── Some workflows are intentionally given short timeouts for rate-limiting
        or time-boxing purposes. Verify this was not intended.
```

### Non-Determinism Crash

```
Workflow Task failing with "nondeterminism" / "NonDeterminismError"
│
├── Read references/core/determinism.md
├── Read references/{language}/versioning.md
│
├── Call temporal.workflow.history to get the full event sequence
│
├── Find the event ID mentioned in the error (or the last successful event)
│   └── Look for the event that differs from what your code would issue
│       Common culprits:
│       ├── ScheduleActivityTask: activity was renamed, added, or removed
│       ├── StartTimer: timer was added or removed, or duration changed
│       └── RecordMarker: a patched() or sideEffect() was added or removed
│
└── Apply a patched() / GetVersion guard around the changed code
    └── See references/core/versioning.md for the 3-phase migration process
```

---

## MCP Tools Quick Reference

| Scenario | Tool | What to Look For |
|----------|------|-----------------|
| Get workflow status | `temporal.workflow.describe` | `status`, `pendingActivities`, `failure` |
| See what happened last | `temporal.workflow.history.summarize` | Last event type and timestamp |
| Full history for non-determinism | `temporal.workflow.history` | Event sequence, event types and attributes |
| Check workers are connected | `temporal.task-queue.describe` | `pollers` array (empty = no workers) |
| Check activity backlog | `temporal.task-queue.describe` | `taskQueueStatus.backlogCountHint` |
| List stuck workflows | `temporal.workflow.list` | Filter by status=RUNNING with old start time |
| Namespace configuration | `temporal.namespace.describe` | Retention period, search attribute definitions |
| Cluster health | `temporal.cluster.info` | Server version, cluster members |

---

## Event History Patterns

The last few events in a workflow's history tell you exactly what it is waiting for:

| Last Event | Workflow Is Waiting For |
|-----------|------------------------|
| `ActivityTaskScheduled` | A worker to pick up the activity (no `ActivityTaskStarted` yet) |
| `ActivityTaskStarted` | The activity to finish or heartbeat |
| `ActivityTaskFailed` | Retry backoff — will retry after the configured interval |
| `ActivityTaskTimedOut` | Timed out — will retry if retries remain |
| `TimerStarted` | The timer to fire (workflow.sleep or deadline) |
| `WorkflowTaskScheduled` | A worker to pick up the Workflow Task |
| `WorkflowExecutionSignalRequested` | Signal delivery in progress |

If `ActivityTaskScheduled` appears with no subsequent `ActivityTaskStarted`, the activity is queued but not picked up. The worker is down or the task queue name is wrong — use `temporal.task-queue.describe`.
