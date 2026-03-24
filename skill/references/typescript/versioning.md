# TypeScript Workflow Versioning

See `references/core/versioning.md` for the general versioning strategy. This file has TypeScript-specific examples.

---

## `patched()` and `deprecatePatch()`

Both are imported from `@temporalio/workflow`.

```typescript
import { patched, deprecatePatch } from '@temporalio/workflow';
```

### Phase 1: Add the Patch

Deploy while old workflow executions are still running. Old executions (no marker in history) run the `else` branch. New executions record the marker and run the `if` branch.

```typescript
export async function fulfillOrderWorkflow(orderId: string): Promise<void> {
  await validateOrder(orderId);

  if (patched('add-fraud-check-v1')) {
    // New behavior: fraud check before payment
    await runFraudCheck(orderId);
    await processPayment(orderId);
  } else {
    // Old behavior: payment without fraud check
    await processPayment(orderId);
  }

  await shipOrder(orderId);
}
```

### Phase 2: Deprecate the Patch

Deploy after all executions running the old (else) branch have completed. `deprecatePatch` records the marker but no longer branches — it signals "all executions at this point have the new behavior."

```typescript
export async function fulfillOrderWorkflow(orderId: string): Promise<void> {
  await validateOrder(orderId);

  deprecatePatch('add-fraud-check-v1');
  await runFraudCheck(orderId);
  await processPayment(orderId);

  await shipOrder(orderId);
}
```

### Phase 3: Remove the Patch

Deploy after all executions that ran Phase 2 (with the `deprecatePatch` marker) have completed. The code is now clean.

```typescript
export async function fulfillOrderWorkflow(orderId: string): Promise<void> {
  await validateOrder(orderId);
  await runFraudCheck(orderId);
  await processPayment(orderId);
  await shipOrder(orderId);
}
```

---

## Multiple Patches

When you have multiple breaking changes, each needs its own patch ID. Patch IDs are strings — use descriptive names with version suffixes.

```typescript
export async function orderWorkflow(orderId: string): Promise<void> {
  if (patched('add-validation-v1')) {
    await validateOrder(orderId);
  }

  if (patched('add-fraud-check-v2')) {
    await runFraudCheck(orderId);
  }

  await processPayment(orderId);

  if (patched('two-step-shipping-v1')) {
    await reserveShipment(orderId);
    await confirmShipment(orderId);
  } else {
    await shipOrder(orderId);
  }
}
```

Each patch follows its own 3-phase lifecycle independently.

---

## Checking the Patch State from Outside

The `patched()` function is only meaningful inside workflow code. To understand which patch markers a specific execution has, use the `temporal.workflow.history` MCP tool and look for `MarkerRecorded` events where `markerName === 'core.patched'` (or similar — the exact name depends on SDK version).

---

## Worker Versioning with Build IDs

Assign a build ID to workers so Temporal can route new executions to new workers automatically:

```typescript
const worker = await Worker.create({
  taskQueue: 'order-processing',
  buildId: process.env.BUILD_ID ?? '1.0.0',
  useVersioning: true,
  workflowsPath: require.resolve('./workflows'),
  activities,
});
```

**Promote a build ID as the default** for new executions:

```sh
temporal task-queue update-build-ids promote-id-to-current \
  --task-queue order-processing \
  --build-id 1.1.0
```

Old executions that started on `1.0.0` continue to be served by workers running `1.0.0`. New executions are routed to `1.1.0` workers.

---

## Replaying Historical Runs Locally

The TypeScript SDK provides a `Replayer` class to verify that new code replays old histories without non-determinism errors before deploying:

```typescript
import { Replayer } from '@temporalio/worker';

const replayer = new Replayer({
  workflowsPath: require.resolve('./workflows'),
});

// Download history with temporal.workflow.history MCP tool or CLI
// then pass the JSON to the replayer
const histories = loadHistoriesFromFile('workflow-histories.json');
for (const history of histories) {
  await replayer.replayHistory(history);
}
```

Run this as a CI step after any workflow code change to catch non-determinism before it reaches production.
