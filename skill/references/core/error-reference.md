# Temporal Error Reference

---

## ApplicationFailure

The most common error type in Temporal applications. Represents a business-logic or application-level error thrown by user code inside an activity or workflow.

**Key properties**:
- `message`: Human-readable description.
- `type`: A string tag used for classification (e.g., `"PaymentDeclined"`, `"NotFound"`). Used to match against `nonRetryableErrorTypes` in retry policies.
- `nonRetryable`: If `true`, Temporal will not retry the activity regardless of the retry policy.
- `cause`: The underlying error that caused this failure (for chaining).
- `details`: Additional structured data attached to the failure.

### Throwing ApplicationFailure

**TypeScript**:

```typescript
import { ApplicationFailure } from '@temporalio/workflow';

// Retryable (default)
throw ApplicationFailure.create({
  message: 'Inventory check failed',
  type: 'InventoryError',
});

// Non-retryable — stops all retries immediately
throw ApplicationFailure.nonRetryable('Payment declined', 'PaymentDeclined');
```

**Python**:

```python
from temporalio.exceptions import ApplicationError

# Retryable (default)
raise ApplicationError("Inventory check failed", type="InventoryError")

# Non-retryable
raise ApplicationError("Payment declined", type="PaymentDeclined", non_retryable=True)
```

**Go**:

```go
import "go.temporal.io/sdk/temporal"

// Retryable
return temporal.NewApplicationError("Inventory check failed", "InventoryError")

// Non-retryable
return temporal.NewNonRetryableApplicationError("Payment declined", "PaymentDeclined", nil)
```

---

## CancelledFailure

Signals that a workflow execution or activity received a cancellation request and is handling it (or was cancelled before it could handle it).

**When it appears**:
- In a workflow: the workflow caught the cancellation (e.g., `CancelledError` in TypeScript, `asyncio.CancelledError` in Python) and completed the run.
- In an activity: the activity's context was cancelled (heartbeat timeout, workflow cancellation) and the activity returned a cancelled failure.

### Detecting and Handling

**TypeScript**:

```typescript
import { isCancellation, CancelledFailure } from '@temporalio/workflow';

export async function myCancellableWorkflow(): Promise<void> {
  try {
    await executeActivity(longRunningActivity, opts);
  } catch (err) {
    if (isCancellation(err)) {
      // Run cleanup
      await executeActivity(cleanupActivity, { ...opts, cancellationType: ActivityCancellationType.ABANDON });
      throw err; // re-throw to mark workflow as CANCELED
    }
    throw err;
  }
}
```

**Python**:

```python
from temporalio.exceptions import CancelledError

@workflow.defn
class MyCancellableWorkflow:
    @workflow.run
    async def run(self) -> None:
        try:
            await workflow.execute_activity(long_running_activity, schedule_to_close_timeout=timedelta(minutes=10))
        except asyncio.CancelledError:
            await workflow.execute_activity(cleanup_activity, schedule_to_close_timeout=timedelta(seconds=30))
            raise
```

---

## TimeoutFailure

An activity or workflow exceeded its configured timeout. The `timeoutType` field distinguishes which timeout fired.

| `timeoutType` | Meaning |
|---------------|---------|
| `SCHEDULE_TO_START` | No worker picked up the activity within the deadline |
| `START_TO_CLOSE` | One activity attempt ran longer than the limit |
| `SCHEDULE_TO_CLOSE` | Total time (all retries combined) exceeded the limit |
| `HEARTBEAT` | The activity did not send a heartbeat within `heartbeatTimeout` |

**Detecting timeout type**:

```typescript
import { TimeoutFailure, TimeoutType } from '@temporalio/common';

try {
    await executeActivity(myActivity, opts);
} catch (err) {
    if (err instanceof TimeoutFailure) {
        if (err.timeoutType === TimeoutType.TIMEOUT_TYPE_START_TO_CLOSE) {
            // activity ran too long
        } else if (err.timeoutType === TimeoutType.TIMEOUT_TYPE_HEARTBEAT) {
            // activity stopped heartbeating
        }
    }
}
```

```python
from temporalio.exceptions import TimeoutError as TemporalTimeoutError
from temporalio.api.enums.v1 import TimeoutType

try:
    await workflow.execute_activity(my_activity, schedule_to_close_timeout=timedelta(minutes=5))
except TemporalTimeoutError as err:
    if err.type == TimeoutType.TIMEOUT_TYPE_HEARTBEAT:
        # activity stopped heartbeating
        pass
```

---

## TerminatedFailure

Represents a workflow that was forcefully terminated via the `terminate` API. There is no recovery — the workflow did not run any cleanup code. No cause or message is attached by the user (though a reason string may be provided to the terminate call).

**Behavior**: The workflow is immediately set to TERMINATED status. Any in-flight activities may continue running on the worker side since the worker was not notified.

---

## ActivityFailure

When an activity fails, Temporal wraps the actual error in an `ActivityFailure`. The `cause` field contains the real error (typically an `ApplicationFailure`, `TimeoutFailure`, or `CancelledFailure`).

```typescript
import { ActivityFailure, ApplicationFailure } from '@temporalio/common';

try {
    await executeActivity(myActivity, opts);
} catch (err) {
    if (err instanceof ActivityFailure) {
        const cause = err.cause;
        if (cause instanceof ApplicationFailure) {
            console.log('Activity failed with type:', cause.type);
        }
    }
}
```

```python
from temporalio.exceptions import ActivityError, ApplicationError

try:
    await workflow.execute_activity(my_activity, schedule_to_close_timeout=timedelta(seconds=30))
except ActivityError as err:
    cause = err.__cause__
    if isinstance(cause, ApplicationError):
        print(f"Activity failed with type: {cause.type}")
```

---

## ChildWorkflowExecutionFailure

The same wrapping pattern applies to child workflows. When a child workflow fails, the parent catches a `ChildWorkflowExecutionFailure`. Check `.cause` for the actual error.

```typescript
import { ChildWorkflowFailure, ApplicationFailure } from '@temporalio/common';

try {
    await executeChild(childWorkflow, { args: [input] });
} catch (err) {
    if (err instanceof ChildWorkflowFailure) {
        const cause = err.cause;
        // cause is typically ApplicationFailure, TimeoutFailure, or CancelledFailure
    }
}
```

---

## ServerError

Temporal cluster returned a gRPC error. Typically transient (rate limiting, overload, network partition). Retried automatically by the SDK client.

**Common causes**:
- `RESOURCE_EXHAUSTED`: Rate limit or quota exceeded on the cluster.
- `UNAVAILABLE`: Cluster is temporarily unreachable.
- `ALREADY_EXISTS`: Workflow ID conflict.

You rarely need to catch `ServerError` in application code — the SDK client retries these automatically.

---

## Non-Retryable Errors

There are two orthogonal ways to mark an error as non-retryable. Understanding which wins is important.

### Method 1: Per-error flag

Set `nonRetryable=true` on the `ApplicationFailure`. Temporal stops retrying regardless of the retry policy.

```typescript
throw ApplicationFailure.nonRetryable('Not found', 'ResourceNotFound');
```

### Method 2: Retry policy `nonRetryableErrorTypes`

List error type strings in the retry policy. Temporal stops retrying if the thrown `ApplicationFailure.type` matches any entry.

```typescript
const opts = {
  scheduleToCloseTimeout: '30m',
  retry: {
    nonRetryableErrorTypes: ['ResourceNotFound', 'PaymentDeclined'],
  },
};
```

### Which wins?

Both are evaluated. If either the per-error flag is `true` **or** the error type matches the retry policy's `nonRetryableErrorTypes` list, Temporal stops retrying. The per-error flag always takes effect regardless of the retry policy.

**Recommendation**: Use the per-error flag (`nonRetryable=true`) when the error is inherently unrecoverable regardless of where it is called from. Use `nonRetryableErrorTypes` in the retry policy when you want to make the same error type non-retryable for a specific activity call without changing the activity implementation.

---

## Error Chain Reference

```
Workflow catches ActivityFailure
└── .cause → ApplicationFailure (message: "...", type: "...", nonRetryable: false|true)

Workflow catches ActivityFailure
└── .cause → TimeoutFailure (timeoutType: START_TO_CLOSE | HEARTBEAT | ...)

Parent workflow catches ChildWorkflowExecutionFailure
└── .cause → ApplicationFailure | TimeoutFailure | CancelledFailure | TerminatedFailure

Activity catches CancelledFailure
└── Workflow was cancelled, or heartbeat timeout fired
```

Always inspect the `cause` chain rather than reading the top-level error message alone — the top-level wrapper (`ActivityFailure`, `ChildWorkflowExecutionFailure`) contains little useful information on its own.
