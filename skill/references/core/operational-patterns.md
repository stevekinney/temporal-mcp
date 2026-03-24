# Operational Patterns: Reading MCP Tool Output

This file bridges the gap between raw `temporal-mcp` tool output and what it means for your code.

---

## Reading Workflow Event Histories

Use `temporal.workflow.history` to fetch the full event sequence. Use `temporal.workflow.history.summarize` for a human-readable digest.

### Key Event Types and Their Meanings

| Event Type | What It Means |
|-----------|---------------|
| `WorkflowExecutionStarted` | The workflow was started. Contains input, workflow type, task queue, timeout settings, and the initial memo/search attributes. |
| `WorkflowTaskScheduled` | The cluster scheduled a Workflow Task — the workflow function needs to run. |
| `WorkflowTaskStarted` | A worker picked up the Workflow Task. |
| `WorkflowTaskCompleted` | The worker completed the Workflow Task — issued commands that matched history or produced new commands. |
| `ActivityTaskScheduled` | The workflow code called `executeActivity`. Contains activity type, input, task queue, retry policy, and timeout settings. |
| `ActivityTaskStarted` | A worker picked up the activity. Contains worker identity and attempt number. |
| `ActivityTaskCompleted` | The activity function returned successfully. Contains the result payload. |
| `ActivityTaskFailed` | The activity function threw an error. Contains the failure message, type, and retry details. |
| `ActivityTaskTimedOut` | The activity exceeded a timeout (heartbeat, startToClose, etc.). Contains the timeout type. |
| `ActivityTaskCanceled` | The activity acknowledged its own cancellation. |
| `TimerStarted` | The workflow code called `workflow.sleep()` or used a deadline. Contains `startToFireTimeout`. |
| `TimerFired` | The timer completed. |
| `TimerCanceled` | The timer was cancelled (e.g., workflow was cancelled before the timer fired). |
| `MarkerRecorded` | A `sideEffect`, `patch` / `patched`, or local activity result was recorded. The marker name indicates which. |
| `SignalExternalWorkflowExecutionInitiated` | The workflow sent a signal to another workflow. |
| `WorkflowExecutionSignaled` | An external signal arrived at this workflow. Contains the signal name and payload. |
| `ChildWorkflowExecutionStarted` | A child workflow was started by this workflow. |
| `ChildWorkflowExecutionCompleted` | A child workflow finished successfully. |
| `ChildWorkflowExecutionFailed` | A child workflow failed. Contains the failure. |
| `WorkflowExecutionCompleted` | The workflow function returned. Contains the result. |
| `WorkflowExecutionFailed` | An unhandled exception reached the root of the workflow function. |
| `WorkflowExecutionTimedOut` | The workflow exceeded its `workflowExecutionTimeout` or `workflowRunTimeout`. |
| `WorkflowExecutionCanceled` | The workflow handled cancellation and exited cleanly. |
| `WorkflowExecutionTerminated` | The workflow was forcefully killed. |
| `WorkflowExecutionContinuedAsNew` | The workflow called `continueAsNew`. The new run ID is referenced. |
| `UpsertWorkflowSearchAttributes` | Search attributes were updated during execution. |

### Pattern: Stuck at ActivityTaskScheduled

```
Event 5: WorkflowTaskCompleted
Event 6: ActivityTaskScheduled   ← activity queued, waiting for worker
  activityType: "FetchInventory"
  taskQueue: "inventory-service"
  scheduleToCloseTimeout: 300s
  (no subsequent ActivityTaskStarted)
```

**Diagnosis**: No worker is polling `inventory-service`. Call `temporal.task-queue.describe` with `taskQueue: "inventory-service"` and check the `pollers` array.

### Pattern: Activity in Retry Loop

```
Event 6:  ActivityTaskScheduled
Event 7:  ActivityTaskStarted     (attempt 1)
Event 8:  ActivityTaskFailed      failure: "connection refused to payments-api"
Event 9:  ActivityTaskScheduled   (retry, attempt 2, backoff applied)
Event 10: ActivityTaskStarted     (attempt 2)
Event 11: ActivityTaskFailed      failure: "connection refused to payments-api"
```

**Diagnosis**: The external service `payments-api` is down or unreachable. Check the activity implementation's external call. If this error is permanent (wrong endpoint, credentials), mark it `nonRetryable` or add to `nonRetryableErrorTypes`.

### Pattern: Non-Determinism Divergence

```
Event 15: ActivityTaskCompleted   activityType: "ValidateOrder"
Event 16: ActivityTaskScheduled   activityType: "ProcessPayment"   ← recorded
  (replay fails here)
```

Current code at event 15 tries to schedule `FulfillOrder` instead of `ProcessPayment`. Temporal detects the mismatch and throws a non-determinism error. The fix is to add a `patched()` / `GetVersion` guard that routes old executions to the old code path.

---

## Task Queue Health

Call `temporal.task-queue.describe` to inspect a task queue.

### Key Fields

```json
{
  "taskQueue": {
    "name": "order-processing",
    "kind": "NORMAL"
  },
  "pollers": [
    {
      "identity": "worker-pod-abc123",
      "lastAccessTime": "2024-11-01T12:34:56Z",
      "ratePerSecond": 100000
    }
  ],
  "taskQueueStatus": {
    "backlogCountHint": 0,
    "readLevel": 12345,
    "ackLevel": 12344
  }
}
```

| Field | What It Means |
|-------|---------------|
| `pollers` | Workers currently long-polling this queue. **Empty = no workers.** |
| `pollers[].lastAccessTime` | When the worker last polled. Stale times (>30s) may indicate the worker is dying. |
| `taskQueueStatus.backlogCountHint` | Approximate number of pending tasks. Non-zero with pollers present = workers are slower than the arrival rate. Non-zero with no pollers = all work is piling up. |

### Correlating with Code

If `temporal.workflow.describe` shows `pendingActivities[0].taskQueue = "order-processing"` and `temporal.task-queue.describe` shows `pollers = []`, the worker that handles the `order-processing` queue is not running. Check:

1. Is the worker process running?
2. Does the worker's configured `taskQueue` match exactly (case-sensitive)?
3. Are there any startup errors in the worker logs?

---

## Common Status Transitions

```
RUNNING ──────────────────────────────► COMPLETED
   │                                       (returned a value)
   │
   ├──► RUNNING (continues after each activity/timer)
   │
   ├──► CONTINUED_AS_NEW ──────────────► new run starts as RUNNING
   │       (continueAsNew called)
   │
   ├──► CANCELED
   │       (cancellation requested + handled, or timed out during cancel)
   │
   ├──► FAILED
   │       (unhandled exception)
   │
   ├──► TIMED_OUT
   │       (workflowExecutionTimeout or workflowRunTimeout expired)
   │
   └──► TERMINATED
           (forced via terminate API — no cleanup)
```

---

## Schedule Debugging

Call `temporal.schedule.describe` for a schedule.

### Key Fields

```json
{
  "schedule": {
    "spec": {
      "cronExpressions": ["0 * * * *"]
    },
    "action": {
      "startWorkflow": {
        "workflowType": "ProcessBatchWorkflow",
        "taskQueue": "batch-processing"
      }
    },
    "policies": {
      "overlapPolicy": "SCHEDULE_OVERLAP_POLICY_SKIP",
      "catchupWindow": "1m"
    }
  },
  "info": {
    "nextActionTimes": ["2024-11-01T13:00:00Z"],
    "recentActions": [
      { "scheduleTime": "2024-11-01T12:00:00Z", "startedWorkflowId": "batch-2024-11-01-12" }
    ],
    "missedCatchupWindow": 0
  }
}
```

| Field | What It Means |
|-------|---------------|
| `info.nextActionTimes` | When the schedule will next fire. Empty = schedule is paused or has no future triggers. |
| `info.recentActions` | The last N workflow starts triggered by this schedule. Check if the started workflow IDs have completed or are stuck. |
| `info.missedCatchupWindow` | Number of scheduled runs that were skipped because the catchup window expired (e.g., schedule fired while paused, resumed too late). |
| `policies.overlapPolicy` | What happens if a triggered workflow is still running when the next trigger fires. `SKIP` is common for batch jobs. |

---

## Worker Deployment Operational Checklist

1. **Verify workers are connected**:
   - Call `temporal.task-queue.describe` for each task queue your workflows use.
   - Confirm `pollers` is non-empty and `lastAccessTime` is recent.

2. **Verify correct registrations**:
   - Workers must register all workflow types and activity types they handle.
   - A workflow trying to execute an activity that no connected worker has registered will result in `ActivityTaskScheduled` with no `ActivityTaskStarted`.

3. **Check worker build ID (if using versioning)**:
   - Call `temporal.worker-deployment.describe` to see which build IDs are assigned and which is the current default.
   - Confirm that new workflow executions are being routed to the expected build ID.

4. **Monitoring backlog**:
   - `taskQueueStatus.backlogCountHint > 0` persistently = workers cannot keep up with the work rate. Scale workers horizontally.

---

## Correlating MCP Output with Code Issues

### Example 1: Activity Failing with External Service Error

```
temporal.workflow.describe →
  pendingActivities[0].attempt = 8
  pendingActivities[0].lastFailure.message = "connection refused: payments-api.internal:8080"
  pendingActivities[0].lastFailure.type = "NetworkError"
```

**What this means in code**: The activity is making an HTTP or gRPC call to `payments-api.internal:8080` and that service is unreachable. The activity will keep retrying per its retry policy.

**Actions**: Check if `payments-api.internal:8080` is running. If the endpoint changed, update the activity's configuration. If this error is permanent, throw `ApplicationFailure.nonRetryable` in the activity so Temporal stops retrying.

### Example 2: Long Schedule-to-Start Time

```
temporal.workflow.describe →
  pendingActivities[0].scheduledTime = "12:00:00"
  (current time = 12:15:00)
  No ActivityTaskStarted event in history
```

**What this means in code**: The activity has been queued for 15 minutes without a worker picking it up.

**Actions**: Call `temporal.task-queue.describe` on the activity's task queue. If pollers is empty, there are no workers. If pollers exist but backlog is high, workers are overloaded — scale out.

### Example 3: High Attempt Count with Successful Recent Attempts

```
temporal.workflow.describe →
  pendingActivities[0].attempt = 23
  pendingActivities[0].lastFailure.message = "rate limit exceeded"
```

**What this means in code**: The activity is hitting a rate limit on an external API. It keeps retrying with exponential backoff.

**Actions**: Check the retry policy's `maximumInterval` — it should be high enough to respect the rate limit reset window. Consider adding jitter. If the rate limit is severe, consider reducing worker concurrency or switching to a schedule-based approach.
