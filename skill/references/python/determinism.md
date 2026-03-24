# Python-Specific Determinism Hazards

See `references/core/determinism.md` for the general determinism contract. This file covers Python-specific hazards.

---

## `datetime.now()`, `datetime.utcnow()`, `time.time()`

Any call that reads the current wall-clock time is non-deterministic.

```python
# WRONG
from datetime import datetime
import time

now = datetime.now()         # non-deterministic
utcnow = datetime.utcnow()   # non-deterministic
ts = time.time()             # non-deterministic

# RIGHT
from temporalio import workflow
now = workflow.now()         # deterministic — from workflow context
```

---

## `asyncio.sleep()`

Using `asyncio.sleep()` inside a workflow puts the coroutine to sleep in the real event loop. This does not create a Temporal timer and will not replay correctly.

```python
# WRONG
import asyncio
await asyncio.sleep(60)  # actual sleep, not a Temporal timer

# RIGHT
from temporalio import workflow
await workflow.sleep(60)  # creates a deterministic Temporal timer
```

---

## `random` Module

```python
# WRONG
import random
value = random.random()  # different on every execution

# RIGHT — use workflow's random instance
from temporalio import workflow
value = workflow.random().random()  # seeded by run ID, same on every replay
```

The `workflow.random()` method returns a `Random` instance seeded deterministically.

---

## Python Workflow Sandbox

The Python SDK runs workflow code inside a "sandbox" that:
- Intercepts module imports to prevent side effects.
- Overrides non-deterministic built-ins (notably `datetime.now` and related calls are not automatically patched — you must use `workflow.now()` explicitly).
- Blocks direct access to the filesystem and network from within workflow code.

If your workflow imports a module that the sandbox cannot import (due to C extensions, network access, etc.), you will see import errors at workflow startup. Move those imports into activities.

**Whitelisting modules from sandbox restrictions**:

```python
from temporalio.worker import Worker, SandboxedWorkflowRunner, SandboxRestrictions

async with Worker(
    client,
    task_queue="my-task-queue",
    workflows=[MyWorkflow],
    activities=[my_activity],
    workflow_runner=SandboxedWorkflowRunner(
        restrictions=SandboxRestrictions.default.with_passthrough_modules("my_pure_module")
    ),
):
    await asyncio.Event().wait()
```

---

## Async Iteration in Workflows

Iterating asynchronously over an external source (websocket, generator that makes network calls) is non-deterministic and belongs in activities.

```python
# WRONG — async generator in workflow
async def workflow_run(self) -> None:
    async for item in fetch_items_from_api():  # non-deterministic I/O
        await workflow.execute_activity(process_item, item, ...)
```

```python
# RIGHT — fetch in activity, process deterministically
async def workflow_run(self) -> None:
    items = await workflow.execute_activity(
        fetch_all_items, schedule_to_close_timeout=timedelta(minutes=5)
    )
    for item in items:  # synchronous iteration over activity result — deterministic
        await workflow.execute_activity(process_item, item, ...)
```

---

## `dict` Iteration Order

In Python 3.7+, `dict` iteration order is insertion order — this is guaranteed by the language spec. Python 3.6 dicts are insertion-ordered as an implementation detail but not guaranteed. If you must support Python 3.6 (very unlikely with modern Temporal SDK), sort keys before iterating.

---

## Global State in Workflow Code

Workflow functions may be replayed many times in the same worker process. Mutable global state shared between workflow executions will leak state from one replay into another.

```python
# WRONG — global mutable state
_cache: dict = {}

@workflow.defn
class MyWorkflow:
    @workflow.run
    async def run(self) -> None:
        _cache['key'] = 'value'  # leaks between replays
```

```python
# RIGHT — use instance variables initialized in __init__
@workflow.defn
class MyWorkflow:
    def __init__(self) -> None:
        self._cache: dict = {}  # fresh per execution

    @workflow.run
    async def run(self) -> None:
        self._cache['key'] = 'value'
```

---

## `logging` in Workflow Code

Standard Python `logging` calls are safe but will execute on every replay, producing duplicate log lines. Use `workflow.logger` which the SDK filters to only emit during non-replay execution:

```python
from temporalio import workflow

@workflow.defn
class MyWorkflow:
    @workflow.run
    async def run(self, order_id: str) -> None:
        workflow.logger.info("Processing order", extra={"order_id": order_id})
        # This only logs during real execution, not replay
```

---

## Exception Handling and Re-raising

If you catch an exception inside a workflow and do not re-raise it, the event history recorded the exception being thrown — but your code pretends it did not happen. On replay, the exception is thrown again at the same point, but this time your catch block handles it silently, changing the subsequent command sequence.

```python
# RISKY — catching all exceptions silently
try:
    await workflow.execute_activity(risky_activity, schedule_to_close_timeout=timedelta(seconds=30))
except Exception:
    pass  # This changes the command sequence vs. original execution if the exception was unexpected
```

```python
# RIGHT — only catch expected error types
from temporalio.exceptions import ApplicationError

try:
    await workflow.execute_activity(risky_activity, schedule_to_close_timeout=timedelta(seconds=30))
except ApplicationError as err:
    if err.type == "ExpectedError":
        handle_expected_error(err)
    else:
        raise  # re-raise unexpected errors
```
