# Common Temporal Gotchas

---

## Timeouts

Temporal has four distinct timeout types for activities. Confusing them is one of the most frequent sources of stuck or unexpectedly-failed workflows.

### Timeout Types

| Timeout | Measures | Triggered When | Default |
|---------|----------|----------------|---------|
| `scheduleToCloseTimeout` | Total time from scheduling to completion, including all retries | The cumulative time from first schedule to final result exceeds the limit | None (unlimited) |
| `scheduleToStartTimeout` | Time waiting in the task queue before a worker picks it up | No worker picks up the activity within the limit | None (unlimited) |
| `startToCloseTimeout` | Time a single attempt can run | One execution attempt runs longer than the limit | None (unlimited) |
| `heartbeatTimeout` | Maximum gap between heartbeats | No heartbeat received within the limit | None (unlimited) |

**You must set at least one of `scheduleToCloseTimeout` or `startToCloseTimeout`.** Setting neither means the activity can run forever.

### The Most Common Mistake: `startToClose` Too Short

```typescript
// WRONG — 10 seconds may not be enough if the activity does real work
const result = await executeActivity(fetchData, {
  startToCloseTimeout: '10s',
});

// WRONG — no timeout at all (will run forever on failure)
const result = await executeActivity(fetchData, {});

// RIGHT — set a realistic timeout; use scheduleToClose for total budget
const result = await executeActivity(fetchData, {
  scheduleToCloseTimeout: '5m',  // total budget including retries
  startToCloseTimeout: '1m',     // max for one attempt
  heartbeatTimeout: '10s',       // for long-running activities
});
```

```python
result = await workflow.execute_activity(
    fetch_data,
    schedule_to_close_timeout=timedelta(minutes=5),
    start_to_close_timeout=timedelta(minutes=1),
    heartbeat_timeout=timedelta(seconds=10),
)
```

---

## Retry Policies

### Default Retry Policy

Temporal retries activities by default with exponential backoff:

| Setting | Default |
|---------|---------|
| Initial interval | 1 second |
| Backoff coefficient | 2.0 |
| Maximum interval | 100 seconds |
| Maximum attempts | Unlimited |
| Non-retryable error types | `[]` |

**The most common mistake**: forgetting that activities retry forever by default. If your activity calls an external service that is permanently down, the workflow will retry until `scheduleToCloseTimeout` expires — potentially days.

### Setting `maximumAttempts`

```typescript
const result = await executeActivity(fetchData, {
  scheduleToCloseTimeout: '30m',
  retry: {
    maximumAttempts: 3,      // give up after 3 attempts total
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
  },
});
```

```python
result = await workflow.execute_activity(
    fetch_data,
    schedule_to_close_timeout=timedelta(minutes=30),
    retry_policy=RetryPolicy(
        maximum_attempts=3,
        initial_interval=timedelta(seconds=2),
        backoff_coefficient=2.0,
        maximum_interval=timedelta(seconds=30),
    ),
)
```

### Non-Retryable Error Types

Mark specific errors as non-retryable to stop immediately without exhausting all attempts:

```typescript
// TypeScript: throw ApplicationFailure with non-retryable flag
throw ApplicationFailure.nonRetryable('Payment declined', 'PaymentDeclined');

// Or configure at the retry policy level
retry: {
  nonRetryableErrorTypes: ['PaymentDeclined', 'InsufficientFunds'],
}
```

```python
# Python: raise with non_retryable=True
raise ApplicationFailure("Payment declined", type="PaymentDeclined", non_retryable=True)
```

---

## Heartbeat Timeout

Activities running longer than ~30 seconds must call `heartbeat()` or they will be retried when the heartbeat timeout expires. The heartbeat is how Temporal knows the activity is still alive.

```typescript
// TypeScript — call periodically in long-running activities
import { Context } from '@temporalio/activity';

export async function processLargeFile(path: string): Promise<void> {
  const lines = await readLines(path);
  for (let i = 0; i < lines.length; i++) {
    if (i % 100 === 0) {
      Context.current().heartbeat({ linesProcessed: i });
    }
    await processLine(lines[i]);
  }
}
```

```python
# Python — import heartbeat from the activity module
from temporalio.activity import heartbeat

async def process_large_file(path: str) -> None:
    lines = await read_lines(path)
    for i, line in enumerate(lines):
        if i % 100 == 0:
            heartbeat({"lines_processed": i})
        await process_line(line)
```

**DO**: Call `heartbeat()` at least once every `heartbeatTimeout / 2`.
**DO**: Pass progress details in the heartbeat payload — use them on retry to resume.
**DON'T**: Heartbeat on every iteration if iterations are very fast (every call is an RPC).

---

## Activity Context in Go

In Go, activities receive a standard `context.Context`. This context is cancelled when:
- The heartbeat timeout expires.
- The workflow that scheduled the activity is cancelled or terminated.
- The `startToCloseTimeout` expires.

```go
func ProcessItems(ctx context.Context, items []string) error {
    for i, item := range items {
        // Check for cancellation before each unit of work
        if ctx.Err() != nil {
            return temporal.NewCanceledError()
        }

        activity.RecordHeartbeat(ctx, i)
        if err := processItem(item); err != nil {
            return err
        }
    }
    return nil
}
```

**DO**: Check `ctx.Err()` before each unit of work.
**DO**: Return `temporal.NewCanceledError()` when cancelled to signal clean shutdown.
**DON'T**: Use `context.Background()` for sub-calls inside an activity — pass the activity context so cancellation propagates.

---

## Worker Shutdown

Workers should drain in-flight tasks before exiting. Killing a worker mid-activity causes the heartbeat to stop, which eventually triggers a retry on another worker — but this wastes time and can leave side effects in intermediate states.

```typescript
// TypeScript — Worker.run() resolves when the worker has drained
const worker = await Worker.create({ ... });
const runPromise = worker.run();

// On SIGINT/SIGTERM, shut down gracefully
process.on('SIGTERM', () => worker.shutdown());
await runPromise;
```

```python
# Python — use Worker as an async context manager
async with Worker(client, task_queue="my-queue", workflows=[...], activities=[...]):
    await asyncio.Event().wait()  # runs until cancelled
# Worker drains on context manager exit
```

**DO**: Send `SIGTERM` and wait for the process to exit cleanly.
**DON'T**: Send `SIGKILL` or `kill -9` while activities are running.

---

## Task Queue Naming

Task queue names are **case-sensitive** and must match exactly between:
1. The worker registration (`taskQueue: 'order-processing'`)
2. The workflow option that schedules activities onto a task queue
3. The client that starts the workflow

A mismatch means activities are scheduled but no worker ever picks them up. The workflow sits in RUNNING state with pending activities and no progress.

**How to check**: Use `temporal.task-queue.describe` with the exact task queue name from your activity options. If pollers are empty, either no workers are connected or the name is wrong.

```typescript
// Worker
const worker = await Worker.create({ taskQueue: 'order-processing', ... });

// Activity options in workflow — must match exactly
const result = await executeActivity(processOrder, {
  taskQueue: 'order-processing', // typo here = stuck workflow
  scheduleToCloseTimeout: '30s',
});
```

---

## Workflow ID Uniqueness

A workflow ID identifies a workflow instance. Starting a new workflow with the same ID as a running workflow depends on the `WorkflowIdReusePolicy`:

| Policy | Behavior |
|--------|----------|
| `ALLOW_DUPLICATE` | Start a new run even if the previous run is still running — results in an error by default |
| `ALLOW_DUPLICATE_FAILED_ONLY` | Only allow re-use if the previous run failed, was cancelled, or timed out |
| `REJECT_DUPLICATE` | Reject the start request if any run with this ID has ever completed |
| `TERMINATE_IF_RUNNING` | Terminate the currently-running workflow and start a new one |

The most common mistake: using a static or predictable workflow ID (e.g., `process-order`) without thinking about what happens when you try to start it again for a different order. Make IDs meaningful and unique per logical instance: `process-order-{orderId}`.

---

## Payload Size Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Single payload (activity input/output, signal payload, query result) | 2 MB | Enforced by default codec |
| Total workflow input | 2 MB | Sum of all input payloads |
| Event history soft warning | ~10 MB | Temporal emits a warning in logs |
| Event history hard limit | Varies (typically 50,000 events or cluster-configured) | Workflow fails to make progress |

**Solution for large payloads**: Store the data in an external store (S3, GCS, database) and pass the URL or identifier as the activity input/output. This pattern is sometimes called the "claim check" pattern.

**DO NOT** pass large binary files, full database records, or large JSON blobs as activity arguments.

---

## Testing

Never use real `sleep()` calls in workflow tests. Use the test environment's time-skipping capabilities.

```typescript
// TypeScript — use @temporalio/testing
import { TestWorkflowEnvironment } from '@temporalio/testing';

const env = await TestWorkflowEnvironment.createTimeSkipping();
const client = env.client;

// The test environment skips time automatically for workflow.sleep() calls
const handle = await client.workflow.start(myWorkflow, { taskQueue: 'test', workflowId: 'test-1' });
const result = await handle.result();
```

```python
# Python — use temporalio.testing
from temporalio.testing import WorkflowEnvironment

async def test_my_workflow():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="test", workflows=[MyWorkflow], activities=[...]):
            result = await env.client.execute_workflow(MyWorkflow.run, id="test-1", task_queue="test")
```

```go
// Go — use go.temporal.io/sdk/testsuite
func TestMyWorkflow(t *testing.T) {
    testSuite := &testsuite.WorkflowTestSuite{}
    env := testSuite.NewTestWorkflowEnvironment()
    env.RegisterWorkflow(MyWorkflow)
    env.RegisterActivity(MyActivity)

    env.ExecuteWorkflow(MyWorkflow, "input")
    require.True(t, env.IsWorkflowCompleted())
    require.NoError(t, env.GetWorkflowError())
}
```

**DO**: Use `TestWorkflowEnvironment` / `WorkflowEnvironment.start_time_skipping()` so tests run in milliseconds even when workflows sleep for days.
**DON'T**: Make real network calls in workflow unit tests — mock activities.
**DON'T**: Use `time.Sleep()` / `asyncio.sleep()` / `time.sleep()` in test code to wait for workflows.
