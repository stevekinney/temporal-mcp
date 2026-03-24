# Python Workflow and Activity Patterns

---

## Activity with Typed Input/Output

Use dataclasses or Pydantic models for structured activity arguments and return values. The SDK uses data converters to serialize/deserialize.

```python
from dataclasses import dataclass
from temporalio import activity, workflow
from datetime import timedelta

@dataclass
class OrderInput:
    order_id: str
    customer_id: str
    items: list[str]

@dataclass
class OrderResult:
    order_id: str
    confirmation_number: str
    total: float

@activity.defn
async def process_order(input: OrderInput) -> OrderResult:
    activity.heartbeat({"order_id": input.order_id})
    # ... process the order
    return OrderResult(
        order_id=input.order_id,
        confirmation_number="CONF-123",
        total=99.99,
    )

@workflow.defn
class OrderWorkflow:
    @workflow.run
    async def run(self, input: OrderInput) -> OrderResult:
        return await workflow.execute_activity(
            process_order,
            input,
            schedule_to_close_timeout=timedelta(minutes=5),
        )
```

---

## Signals and Queries

```python
from temporalio import workflow
import asyncio
from datetime import timedelta

@workflow.defn
class ApprovalWorkflow:
    def __init__(self) -> None:
        self._approved: bool | None = None
        self._comment: str = ""

    @workflow.signal
    def approve(self, comment: str) -> None:
        self._approved = True
        self._comment = comment

    @workflow.signal
    def reject(self, comment: str) -> None:
        self._approved = False
        self._comment = comment

    @workflow.query
    def decision(self) -> dict:
        return {"approved": self._approved, "comment": self._comment}

    @workflow.run
    async def run(self, request_id: str) -> str:
        # Wait up to 7 days for a decision
        try:
            await workflow.wait_condition(
                lambda: self._approved is not None,
                timeout=timedelta(days=7),
            )
        except asyncio.TimeoutError:
            return "timed_out"

        return "approved" if self._approved else "rejected"
```

---

## Fan-out / Fan-in

```python
import asyncio
from temporalio import workflow
from datetime import timedelta

@workflow.defn
class BatchProcessWorkflow:
    @workflow.run
    async def run(self, item_ids: list[str]) -> list[str]:
        tasks = [
            workflow.execute_activity(
                process_item,
                item_id,
                schedule_to_close_timeout=timedelta(seconds=60),
            )
            for item_id in item_ids
        ]
        results = await asyncio.gather(*tasks)
        return list(results)
```

For fault tolerance (continue even if some items fail):

```python
results = await asyncio.gather(*tasks, return_exceptions=True)
successes = [r for r in results if not isinstance(r, Exception)]
failures = [r for r in results if isinstance(r, Exception)]
```

---

## Saga / Compensating Transactions

```python
from temporalio import workflow
from datetime import timedelta

@workflow.defn
class BookTravelWorkflow:
    @workflow.run
    async def run(self, trip: TripRequest) -> None:
        compensations = []
        try:
            await workflow.execute_activity(
                book_flight, trip.flight_id,
                schedule_to_close_timeout=timedelta(seconds=30)
            )
            compensations.append(
                lambda: workflow.execute_activity(
                    cancel_flight, trip.flight_id,
                    schedule_to_close_timeout=timedelta(seconds=30)
                )
            )

            await workflow.execute_activity(
                book_hotel, trip.hotel_id,
                schedule_to_close_timeout=timedelta(seconds=30)
            )
            compensations.append(
                lambda: workflow.execute_activity(
                    cancel_hotel, trip.hotel_id,
                    schedule_to_close_timeout=timedelta(seconds=30)
                )
            )

        except Exception:
            for compensate in reversed(compensations):
                try:
                    await compensate()
                except Exception as comp_err:
                    workflow.logger.error(f"Compensation failed: {comp_err}")
            raise
```

---

## Child Workflows

```python
from temporalio import workflow
from temporalio.exceptions import ChildWorkflowError
from datetime import timedelta

@workflow.defn
class ParentWorkflow:
    @workflow.run
    async def run(self, order_ids: list[str]) -> list[str]:
        results = []
        for order_id in order_ids:
            try:
                result = await workflow.execute_child_workflow(
                    ProcessOrderWorkflow.run,
                    order_id,
                    id=f"process-order-{order_id}",
                    task_queue="order-processing",
                )
                results.append(result)
            except ChildWorkflowError as err:
                workflow.logger.error(f"Child failed for {order_id}: {err.__cause__}")
        return results
```

---

## Continue-as-New

```python
from temporalio import workflow
from temporalio.exceptions import ContinueAsNewError
from dataclasses import dataclass
from datetime import timedelta

@dataclass
class PollerState:
    processed_count: int
    last_cursor: str | None

@workflow.defn
class PollerWorkflow:
    @workflow.run
    async def run(self, state: PollerState) -> None:
        result = await workflow.execute_activity(
            poll_and_process,
            state.last_cursor,
            schedule_to_close_timeout=timedelta(minutes=5),
        )

        state.processed_count += result.count
        state.last_cursor = result.next_cursor

        # Restart with fresh history every 500 items processed
        if state.processed_count % 500 == 0:
            await workflow.continue_as_new(state)
```

---

## Long-Running Activity with Heartbeat and Resume

```python
from temporalio import activity

@activity.defn
async def process_records(dataset_id: str) -> int:
    # Resume from last heartbeat on retry
    details = activity.info().heartbeat_details
    start_from = details[0] if details else 0

    records = await load_records(dataset_id)
    processed = start_from

    for i in range(start_from, len(records)):
        # Heartbeat every 50 records
        if i % 50 == 0:
            activity.heartbeat(i)

        await process_record(records[i])
        processed = i + 1

    return processed
```

---

## Workflow Update (SDK 1.x+)

Updates allow external code to send a message and receive a validated response synchronously.

```python
from temporalio import workflow

@workflow.defn
class CartWorkflow:
    def __init__(self) -> None:
        self._items: list[str] = []

    @workflow.update
    async def add_item(self, item_id: str) -> str:
        self._items.append(item_id)
        return f"Added {item_id}"

    @add_item.validator
    def validate_add_item(self, item_id: str) -> None:
        if not item_id:
            raise ValueError("item_id cannot be empty")
        if len(self._items) >= 100:
            raise ValueError("Cart is full")

    @workflow.run
    async def run(self) -> list[str]:
        await workflow.wait_condition(lambda: len(self._items) >= 10, timeout=timedelta(days=30))
        return self._items
```
