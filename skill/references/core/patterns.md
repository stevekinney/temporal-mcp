# Common Temporal Workflow Patterns

---

## Saga Pattern (Compensating Transactions)

**When to use**: Coordinating a sequence of operations across multiple services where each step must be rolled back if a later step fails. Unlike database transactions, Temporal sagas use compensating activities (explicit undo operations) rather than two-phase commit.

### TypeScript

```typescript
import { executeActivity, proxyActivities } from '@temporalio/workflow';

const { bookFlight, bookHotel, chargeCard, cancelFlight, cancelHotel, refundCard } =
  proxyActivities<TravelActivities>({ scheduleToCloseTimeout: '30s' });

export async function bookTravelWorkflow(trip: TripRequest): Promise<void> {
  const compensations: Array<() => Promise<void>> = [];

  try {
    await bookFlight(trip.flightId);
    compensations.push(() => cancelFlight(trip.flightId));

    await bookHotel(trip.hotelId);
    compensations.push(() => cancelHotel(trip.hotelId));

    await chargeCard(trip.cardToken, trip.totalCost);
    compensations.push(() => refundCard(trip.cardToken, trip.totalCost));
  } catch (err) {
    // Run compensations in reverse order
    for (const compensate of compensations.reverse()) {
      await compensate();
    }
    throw err;
  }
}
```

### Python

```python
import asyncio
from temporalio import workflow
from temporalio.common import RetryPolicy

@workflow.defn
class BookTravelWorkflow:
    @workflow.run
    async def run(self, trip: TripRequest) -> None:
        compensations = []
        try:
            await workflow.execute_activity(
                book_flight, trip.flight_id, schedule_to_close_timeout=timedelta(seconds=30)
            )
            compensations.append(lambda: workflow.execute_activity(
                cancel_flight, trip.flight_id, schedule_to_close_timeout=timedelta(seconds=30)
            ))

            await workflow.execute_activity(
                book_hotel, trip.hotel_id, schedule_to_close_timeout=timedelta(seconds=30)
            )
            compensations.append(lambda: workflow.execute_activity(
                cancel_hotel, trip.hotel_id, schedule_to_close_timeout=timedelta(seconds=30)
            ))

        except Exception:
            for compensate in reversed(compensations):
                await compensate()
            raise
```

**Key gotchas**:
- Compensating activities can also fail — wrap them in retry logic or log failures and continue.
- Do not use try/finally for compensations if you want the workflow to reflect the original failure.
- Each compensation activity should be idempotent.

---

## Fan-out / Fan-in

**When to use**: Processing a list of items in parallel (batch processing, parallel API calls, map-reduce style work).

### TypeScript

```typescript
import { executeActivity, proxyActivities } from '@temporalio/workflow';

const { processItem } = proxyActivities<ProcessingActivities>({
  scheduleToCloseTimeout: '60s',
});

export async function fanOutWorkflow(items: string[]): Promise<string[]> {
  // Start all activities in parallel
  const promises = items.map((item) => processItem(item));
  // Wait for all to complete
  const results = await Promise.all(promises);
  return results;
}
```

### Python

```python
import asyncio
from temporalio import workflow

@workflow.defn
class FanOutWorkflow:
    @workflow.run
    async def run(self, items: list[str]) -> list[str]:
        tasks = [
            workflow.execute_activity(
                process_item, item, schedule_to_close_timeout=timedelta(seconds=60)
            )
            for item in items
        ]
        results = await asyncio.gather(*tasks)
        return list(results)
```

### Go

```go
func FanOutWorkflow(ctx workflow.Context, items []string) ([]string, error) {
    results := make([]string, len(items))
    errs := make([]error, len(items))

    var wg sync.WaitGroup
    for i, item := range items {
        i, item := i, item
        workflow.Go(ctx, func(ctx workflow.Context) {
            defer wg.Done()
            err := workflow.ExecuteActivity(ctx, ProcessItem, item).Get(ctx, &results[i])
            errs[i] = err
        })
        wg.Add(1)
    }
    wg.Wait(ctx)

    for _, err := range errs {
        if err != nil { return nil, err }
    }
    return results, nil
}
```

**Key gotchas**:
- Very large fan-outs (thousands of items) can create very large event histories. Consider batching or child workflows.
- `Promise.all` / `asyncio.gather` fail fast on the first error. Use `Promise.allSettled` / `asyncio.gather(return_exceptions=True)` if you need all results regardless of failures.

---

## Child Workflows

**When to use**:
- The sub-process needs its own retry policy, timeout, or task queue.
- The sub-process produces a very long event history and you want to isolate it.
- You want independent cancellation semantics.
- Running sub-processes in a separate namespace.

### TypeScript

```typescript
import { executeChild } from '@temporalio/workflow';

export async function parentWorkflow(orderId: string): Promise<void> {
  const result = await executeChild(processOrderWorkflow, {
    args: [orderId],
    workflowId: `process-order-${orderId}`,
    taskQueue: 'order-processing',
  });
  // result is the return value of processOrderWorkflow
}
```

### Python

```python
from temporalio import workflow

@workflow.defn
class ParentWorkflow:
    @workflow.run
    async def run(self, order_id: str) -> None:
        result = await workflow.execute_child_workflow(
            ProcessOrderWorkflow,
            order_id,
            id=f"process-order-{order_id}",
            task_queue="order-processing",
        )
```

**Key gotchas**:
- Child workflow failures surface as `ChildWorkflowExecutionFailure` wrapping the actual cause.
- Cancelling the parent propagates cancellation to children by default. Control this with `ParentClosePolicy`.
- Child workflows have their own event histories — use them to keep parent history small.

---

## Signals

**When to use**: Pushing external events into a running workflow (order approved, payment received, user input).

### TypeScript

```typescript
import { defineSignal, setHandler, condition } from '@temporalio/workflow';

const approvalSignal = defineSignal<[{ approved: boolean }]>('approval');

export async function approvalWorkflow(): Promise<string> {
  let approved: boolean | undefined;

  setHandler(approvalSignal, ({ approved: value }) => {
    approved = value;
  });

  // Wait until the signal sets approved
  await condition(() => approved !== undefined, '7 days');

  return approved ? 'approved' : 'rejected';
}
```

### Python

```python
from temporalio import workflow

@workflow.defn
class ApprovalWorkflow:
    def __init__(self) -> None:
        self._approved: bool | None = None

    @workflow.signal
    def approval(self, approved: bool) -> None:
        self._approved = approved

    @workflow.run
    async def run(self) -> str:
        await workflow.wait_condition(
            lambda: self._approved is not None,
            timeout=timedelta(days=7),
        )
        return "approved" if self._approved else "rejected"
```

**Key gotchas**:
- Signal handlers must not block (no `await` in TypeScript, no `await` in Python signal handler body).
- Do not poll for signals with arbitrary `while True` loops and sleeps — use `condition()` / `wait_condition()`.
- Signals sent to a completed workflow raise an error.

---

## Queries

**When to use**: Reading the current state of a workflow without changing it. Synchronous — returns immediately.

Queries differ from signals: signals change state, queries only read it. Queries cannot modify workflow state or schedule new commands.

### TypeScript

```typescript
import { defineQuery, setHandler } from '@temporalio/workflow';

const statusQuery = defineQuery<WorkflowStatus>('getStatus');

export async function orderWorkflow(order: Order): Promise<void> {
  let status: WorkflowStatus = { phase: 'pending', progress: 0 };

  setHandler(statusQuery, () => status);

  status = { phase: 'processing', progress: 50 };
  await executeActivity(processOrder, order, { scheduleToCloseTimeout: '30s' });
  status = { phase: 'complete', progress: 100 };
}
```

### Python

```python
from temporalio import workflow

@workflow.defn
class OrderWorkflow:
    def __init__(self) -> None:
        self._status = {"phase": "pending", "progress": 0}

    @workflow.query
    def get_status(self) -> dict:
        return self._status

    @workflow.run
    async def run(self, order: Order) -> None:
        self._status = {"phase": "processing", "progress": 50}
        await workflow.execute_activity(process_order, order, schedule_to_close_timeout=timedelta(seconds=30))
        self._status = {"phase": "complete", "progress": 100}
```

---

## Continue-as-New

**When to use**: Event history grows too large (approaching 50,000 events or several MB). Continue-as-new starts a fresh workflow run with new (empty) history, passing forward any state you need.

### TypeScript

```typescript
import { continueAsNew } from '@temporalio/workflow';

export async function longRunningWorkflow(state: WorkflowState): Promise<void> {
  while (true) {
    await executeActivity(doWork, state, { scheduleToCloseTimeout: '60s' });
    state.iterationCount++;

    if (state.iterationCount % 1000 === 0) {
      // Restart with fresh history, carry state forward
      await continueAsNew<typeof longRunningWorkflow>(state);
    }
  }
}
```

### Python

```python
from temporalio import workflow

@workflow.defn
class LongRunningWorkflow:
    @workflow.run
    async def run(self, state: WorkflowState) -> None:
        while True:
            await workflow.execute_activity(
                do_work, state, schedule_to_close_timeout=timedelta(seconds=60)
            )
            state.iteration_count += 1

            if state.iteration_count % 1000 == 0:
                await workflow.continue_as_new(state)
```

**Key gotchas**:
- After `continueAsNew`, the current run ends immediately. Any code after the call never executes.
- The new run starts with the arguments you pass — serialize all necessary state.
- Signals received between runs may be lost. Consider buffering them before calling continue-as-new.

---

## Heartbeating Long-Running Activities

**When to use**: Activities that take longer than ~30 seconds. Without heartbeating, Temporal cannot distinguish a slow activity from a crashed worker.

### TypeScript

```typescript
import { Context, heartbeat, CancelledFailure } from '@temporalio/activity';

export async function longProcessingActivity(items: string[]): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    Context.current().heartbeat({ processedCount: i });

    // Check for cancellation
    await processItem(items[i]);
  }
}
```

### Python

```python
from temporalio.activity import heartbeat, is_cancelled

async def long_processing_activity(items: list[str]) -> None:
    for i, item in enumerate(items):
        heartbeat({"processed_count": i})
        await process_item(item)
```

**Key gotchas**:
- Set `heartbeatTimeout` in the activity options, not just `startToCloseTimeout`. If a heartbeat is not received within `heartbeatTimeout`, Temporal schedules the activity for retry on a different worker.
- The heartbeat details are available on retry via `activity.GetHeartbeatDetails()` (Go) / `activity.info().heartbeat_details` (Python) / `Context.current().heartbeatDetails` (TypeScript) — use this to resume from where you left off.
- Do not heartbeat too frequently (every few seconds is sufficient). Each heartbeat is an RPC call.

---

## Local Activities

**When to use**: Fast operations (< 1 second) that you need to run without the overhead of a round-trip to the Temporal cluster for scheduling. Local activities run in the same worker process that executed the Workflow Task.

**Tradeoffs**:
- Pro: Lower latency, no separate ActivityTaskScheduled/Started/Completed events in history.
- Con: If the worker crashes, local activities that were in-flight are retried from the beginning (no separate heartbeat). Not suitable for operations with significant side effects that cannot be retried safely.
- Con: Local activity failures can block the Workflow Task from completing.

```typescript
import { executeLocalActivity } from '@temporalio/workflow';

export async function myWorkflow(input: string): Promise<string> {
  // Use for fast, cheap, idempotent work
  const hash = await executeLocalActivity(computeHash, {
    scheduleToCloseTimeout: '5s',
    args: [input],
  });
  return hash;
}
```

```python
from temporalio import workflow

@workflow.defn
class MyWorkflow:
    @workflow.run
    async def run(self, input: str) -> str:
        hash_value = await workflow.execute_local_activity(
            compute_hash, input, schedule_to_close_timeout=timedelta(seconds=5)
        )
        return hash_value
```
