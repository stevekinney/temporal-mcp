# Python Workflow Versioning

See `references/core/versioning.md` for the general versioning strategy. This file has Python-specific examples.

---

## `workflow.patched()` and `workflow.deprecate_patch()`

```python
from temporalio import workflow
```

### Phase 1: Add the Patch

Deploy while old workflow executions are still running. Old executions (no marker in history) evaluate `workflow.patched()` as `False` and run the else branch. New executions record the marker and run the if branch.

```python
@workflow.defn
class FulfillOrderWorkflow:
    @workflow.run
    async def run(self, order_id: str) -> None:
        await workflow.execute_activity(
            validate_order, order_id,
            schedule_to_close_timeout=timedelta(seconds=30)
        )

        if workflow.patched("add-fraud-check-v1"):
            # New behavior: fraud check before payment
            await workflow.execute_activity(
                run_fraud_check, order_id,
                schedule_to_close_timeout=timedelta(seconds=30)
            )
            await workflow.execute_activity(
                process_payment, order_id,
                schedule_to_close_timeout=timedelta(minutes=1)
            )
        else:
            # Old behavior: payment without fraud check
            await workflow.execute_activity(
                process_payment, order_id,
                schedule_to_close_timeout=timedelta(minutes=1)
            )

        await workflow.execute_activity(
            ship_order, order_id,
            schedule_to_close_timeout=timedelta(minutes=2)
        )
```

### Phase 2: Deprecate the Patch

Deploy after all executions running the old (else) branch have completed. `deprecate_patch` records the marker but no longer branches.

```python
@workflow.defn
class FulfillOrderWorkflow:
    @workflow.run
    async def run(self, order_id: str) -> None:
        await workflow.execute_activity(validate_order, order_id, ...)

        workflow.deprecate_patch("add-fraud-check-v1")
        await workflow.execute_activity(run_fraud_check, order_id, ...)
        await workflow.execute_activity(process_payment, order_id, ...)
        await workflow.execute_activity(ship_order, order_id, ...)
```

### Phase 3: Remove the Patch

Deploy after all executions that ran Phase 2 (with the `deprecate_patch` marker) have completed.

```python
@workflow.defn
class FulfillOrderWorkflow:
    @workflow.run
    async def run(self, order_id: str) -> None:
        await workflow.execute_activity(validate_order, order_id, ...)
        await workflow.execute_activity(run_fraud_check, order_id, ...)
        await workflow.execute_activity(process_payment, order_id, ...)
        await workflow.execute_activity(ship_order, order_id, ...)
```

---

## Multiple Patches

Each breaking change gets its own patch ID. Manage each independently through its own 3-phase lifecycle.

```python
@workflow.defn
class OrderWorkflow:
    @workflow.run
    async def run(self, order_id: str) -> None:
        if workflow.patched("add-validation-step-v1"):
            await workflow.execute_activity(validate_order, order_id, ...)

        await workflow.execute_activity(process_order, order_id, ...)

        if workflow.patched("two-phase-shipping-v1"):
            await workflow.execute_activity(reserve_shipment, order_id, ...)
            await workflow.execute_activity(confirm_shipment, order_id, ...)
        else:
            await workflow.execute_activity(ship_order, order_id, ...)
```

---

## New Workflow Type Strategy

For sweeping changes, deploy a new workflow class and route new starts there. Let old instances complete on the old class.

```python
# Original — keep for draining in-flight executions
@workflow.defn
class ProcessOrderWorkflow:
    @workflow.run
    async def run(self, order_id: str) -> None: ...

# New version — route new orders here
@workflow.defn
class ProcessOrderWorkflowV2:
    @workflow.run
    async def run(self, order_id: str) -> None: ...
```

Register both in the worker during the migration period:

```python
async with Worker(
    client,
    task_queue="order-processing",
    workflows=[ProcessOrderWorkflow, ProcessOrderWorkflowV2],
    activities=[...],
):
    await asyncio.Event().wait()
```

---

## Worker Versioning with Build IDs

```python
from temporalio.worker import Worker

async with Worker(
    client,
    task_queue="order-processing",
    workflows=[ProcessOrderWorkflowV2],
    activities=[...],
    build_id=os.environ.get("BUILD_ID", "1.0.0"),
    use_worker_versioning=True,
):
    await asyncio.Event().wait()
```

Promote the new build ID to default using the Temporal CLI or MCP tool:

```sh
temporal task-queue update-build-ids promote-id-to-current \
  --task-queue order-processing \
  --build-id 1.1.0
```

---

## Verifying Replay Safety

Use the Temporal Python SDK's replayer to test that new code replays existing histories without non-determinism errors. Download a history with `temporal.workflow.history` MCP tool or the Temporal CLI, then replay it locally:

```python
from temporalio.worker import Replayer

async def verify_replay():
    replayer = Replayer(workflows=[MyWorkflow])

    # Load history JSON exported from the cluster
    with open("workflow_history.json") as f:
        history_json = f.read()

    await replayer.replay_workflow(WorkflowHistory.from_json("my-workflow-id", history_json))
    print("Replay succeeded — code is determinism-safe")
```

Run this in CI after any workflow code change.
