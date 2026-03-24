# Python-Specific Gotchas

---

## Async Activity Heartbeat

In Python, `activity.heartbeat()` is a **synchronous** call even in async activities. You do not `await` it.

```python
from temporalio import activity

@activity.defn
async def long_activity(data: str) -> None:
    for i in range(1000):
        activity.heartbeat({"progress": i})  # NO await — synchronous call
        await do_work_unit(data, i)
```

Do not confuse this with `await activity.heartbeat_async()` which is not a standard SDK function — `heartbeat()` is synchronous by design.

---

## Workflow Sandbox Restrictions

The Python SDK runs workflow code in a sandboxed module environment. Common sandbox restrictions that catch developers off-guard:

**C extension modules**: Most C extension modules (numpy, psycopg2, cryptography, etc.) cannot be imported inside the workflow sandbox. Move any usage to activities.

```python
# WRONG — numpy is a C extension, not importable in workflow sandbox
@workflow.defn
class MyWorkflow:
    @workflow.run
    async def run(self, data: list[float]) -> float:
        import numpy as np
        return float(np.mean(data))  # ImportError in sandbox

# RIGHT — move computation to an activity
@activity.defn
async def compute_mean(data: list[float]) -> float:
    import numpy as np
    return float(np.mean(data))
```

**Workaround for pure Python modules**: Pass them through the sandbox restrictions:

```python
from temporalio.worker import SandboxedWorkflowRunner, SandboxRestrictions

async with Worker(
    client,
    task_queue="my-task-queue",
    workflows=[MyWorkflow],
    activities=[compute_mean],
    workflow_runner=SandboxedWorkflowRunner(
        restrictions=SandboxRestrictions.default.with_passthrough_modules("my_pure_module")
    ),
):
    await asyncio.Event().wait()
```

---

## Activity Registration

Each activity function must be explicitly listed when creating the Worker. Forgetting to register an activity results in `ActivityTaskScheduled` with no worker picking it up.

```python
from myapp.activities import process_order, send_notification, validate_order

async with Worker(
    client,
    task_queue="my-task-queue",
    workflows=[OrderWorkflow],
    activities=[
        process_order,      # must be listed individually
        send_notification,
        validate_order,
    ],
):
    await asyncio.Event().wait()
```

There is no equivalent to TypeScript's "pass the whole module" pattern — list each activity function.

---

## Signal Handler Must Be Synchronous

Signal handler methods decorated with `@workflow.signal` must be synchronous — they must not be `async def` and must not contain `await` statements.

```python
# WRONG — async signal handler
@workflow.signal
async def my_signal(self, payload: str) -> None:
    await workflow.execute_activity(handle_signal, payload)  # WRONG

# RIGHT — synchronous, sets state; main body reacts
@workflow.signal
def my_signal(self, payload: str) -> None:
    self._pending_signal = payload  # just set state

@workflow.run
async def run(self) -> None:
    while True:
        await workflow.wait_condition(lambda: self._pending_signal is not None)
        payload = self._pending_signal
        self._pending_signal = None
        await workflow.execute_activity(handle_signal, payload, ...)
```

---

## Dataclass Serialization

The default data converter serializes dataclasses to JSON. All fields must be JSON-serializable. Common pitfalls:

```python
from dataclasses import dataclass
from datetime import datetime

# WRONG — datetime is not JSON-serializable by default
@dataclass
class WorkflowInput:
    start_date: datetime  # fails serialization

# RIGHT — use ISO string and parse in the activity/workflow
@dataclass
class WorkflowInput:
    start_date: str  # e.g., "2024-11-01T12:00:00Z"
```

For complex types, use a custom data converter or Pydantic with the `temporalio-pydantic` extra.

---

## `asyncio.CancelledError` vs Temporal Cancellation

When a workflow is cancelled, Temporal raises `asyncio.CancelledError` (which is a subclass of `BaseException`, not `Exception`) at the next `await` point. If you use bare `except Exception:`, you will not catch it. If you use `except BaseException:`, you will catch it — but make sure to re-raise it after cleanup.

```python
# WRONG — bare Exception does not catch CancelledError
try:
    await workflow.execute_activity(my_activity, schedule_to_close_timeout=timedelta(seconds=30))
except Exception as err:
    # asyncio.CancelledError is NOT caught here
    handle_error(err)

# RIGHT — handle CancelledError explicitly
try:
    await workflow.execute_activity(my_activity, schedule_to_close_timeout=timedelta(seconds=30))
except asyncio.CancelledError:
    await workflow.execute_activity(cleanup, schedule_to_close_timeout=timedelta(seconds=30))
    raise  # must re-raise to mark workflow as CANCELED
except Exception as err:
    handle_error(err)
```

---

## Worker Task Queue: Case Sensitivity

Task queue names are case-sensitive. A worker registered on `"order-processing"` will not pick up activities scheduled on `"Order-Processing"` or `"ORDER-PROCESSING"`. Always use a constant:

```python
TASK_QUEUE = "order-processing"  # define once

# Worker
async with Worker(client, task_queue=TASK_QUEUE, ...):
    ...

# Workflow
await workflow.execute_activity(my_activity, task_queue=TASK_QUEUE, ...)

# Client
handle = await client.start_workflow(MyWorkflow.run, id="wf-1", task_queue=TASK_QUEUE)
```

---

## Testing: Use `WorkflowEnvironment.start_time_skipping()`

```python
import asyncio
import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

@pytest.mark.asyncio
async def test_order_workflow():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(
            env.client,
            task_queue="test",
            workflows=[OrderWorkflow],
            activities=[process_order, send_notification],
        ):
            result = await env.client.execute_workflow(
                OrderWorkflow.run,
                OrderInput(order_id="order-1", customer_id="cust-1", items=["item-a"]),
                id="test-order-1",
                task_queue="test",
            )
            assert result.order_id == "order-1"
```

`start_time_skipping()` auto-advances time when all coroutines are blocked on timers, so `workflow.sleep(timedelta(days=7))` completes in milliseconds during testing.
