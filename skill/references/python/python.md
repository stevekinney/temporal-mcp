# Temporal Python SDK

## Setup

```sh
pip install temporalio
```

Or with a project managed by `uv` or `poetry`:

```sh
uv add temporalio
poetry add temporalio
```

## Project Structure

```
myapp/
  workflows.py         # workflow definitions
  activities.py        # activity implementations
  worker.py            # worker bootstrap
  run_workflow.py      # client code (starting workflows)
```

## Worker Bootstrap

```python
import asyncio
from temporalio.client import Client
from temporalio.worker import Worker
from myapp.workflows import OrderWorkflow
from myapp import activities

async def main():
    client = await Client.connect(
        "localhost:7233",
        namespace="default",
    )

    async with Worker(
        client,
        task_queue="my-task-queue",
        workflows=[OrderWorkflow],
        activities=[
            activities.process_order,
            activities.send_notification,
        ],
    ):
        # Worker runs until the context manager exits
        await asyncio.Event().wait()

if __name__ == "__main__":
    asyncio.run(main())
```

## Workflow Definition

```python
import asyncio
from datetime import timedelta
from temporalio import workflow
from temporalio.common import RetryPolicy

# Import activities with TYPE_CHECKING to avoid circular imports in the sandbox
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from myapp import activities


@workflow.defn
class OrderWorkflow:
    def __init__(self) -> None:
        self._status = "pending"
        self._cancelled = False

    @workflow.signal
    def cancel(self) -> None:
        self._cancelled = True

    @workflow.query
    def status(self) -> str:
        return self._status

    @workflow.run
    async def run(self, order_id: str) -> str:
        if self._cancelled:
            return "cancelled"

        self._status = "processing"
        result = await workflow.execute_activity(
            "process_order",
            order_id,
            schedule_to_close_timeout=timedelta(minutes=5),
            start_to_close_timeout=timedelta(minutes=1),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._status = "notifying"
        await workflow.execute_activity(
            "send_notification",
            args=[result["customer_id"], result["message"]],
            schedule_to_close_timeout=timedelta(seconds=30),
        )

        self._status = "complete"
        return result["order_id"]
```

## Activity Definition

```python
from temporalio import activity
from temporalio.exceptions import ApplicationError

@activity.defn
async def process_order(order_id: str) -> dict:
    # Activities run in normal async Python — I/O is fine here
    activity.heartbeat({"order_id": order_id, "step": "processing"})

    order = await db.orders.find_by_id(order_id)
    if order is None:
        raise ApplicationError(
            f"Order {order_id} not found",
            type="NotFound",
            non_retryable=True,
        )

    # ... process the order
    return {"customer_id": order.customer_id, "message": "Order processed", "order_id": order_id}
```

## Client Usage

```python
import asyncio
from temporalio.client import Client
from myapp.workflows import OrderWorkflow

async def start_order(order_id: str) -> str:
    client = await Client.connect("localhost:7233")

    handle = await client.start_workflow(
        OrderWorkflow.run,
        order_id,
        id=f"order-{order_id}",
        task_queue="my-task-queue",
    )

    print(f"Started workflow {handle.id}")
    result = await handle.result()
    return result
```

## Temporal Cloud Connection

```python
from temporalio.client import Client, TLSConfig

client = await Client.connect(
    "your-namespace.tmprl.cloud:7233",
    namespace="your-namespace.your-account",
    tls=TLSConfig(
        client_cert=open("client.pem", "rb").read(),
        client_private_key=open("client.key", "rb").read(),
    ),
)
```

## asyncio Model

The Python SDK uses `asyncio` for both workflows and activities. Key points:

- **Workflow functions** run inside a sandboxed environment. The sandbox intercepts determinism-breaking calls.
- **Activity functions** run in the regular asyncio event loop — normal I/O is fine.
- **Workflows must not use `asyncio.sleep()`** — use `await workflow.sleep()` instead.
- **Workflows must not use `datetime.now()`** — use `workflow.now()` instead.
- The SDK also supports running activities in a thread pool executor for CPU-bound or synchronous code (pass `activity_executor` to the Worker).

## Synchronous Activities

For blocking I/O or CPU-bound activities, use a thread or process executor:

```python
import concurrent.futures
from temporalio.worker import Worker

async def main():
    client = await Client.connect("localhost:7233")

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        async with Worker(
            client,
            task_queue="my-task-queue",
            workflows=[MyWorkflow],
            activities=[sync_activity],
            activity_executor=executor,
        ):
            await asyncio.Event().wait()
```

Synchronous activity functions (defined with `def` instead of `async def`) are automatically run in the executor.
