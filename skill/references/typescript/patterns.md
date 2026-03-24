# TypeScript Workflow and Activity Patterns

---

## Activity Proxy with Per-Activity Timeouts

Use `proxyActivities` for default timeouts, or multiple proxies for different timeout profiles:

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as Activities from '../activities';

// Fast activities — strict timeouts
const { validateInput, lookupCache } = proxyActivities<typeof Activities>({
  scheduleToCloseTimeout: '10s',
  startToCloseTimeout: '5s',
  retry: { maximumAttempts: 2 },
});

// Slow activities — relaxed timeouts
const { processLargeFile, generateReport } = proxyActivities<typeof Activities>({
  scheduleToCloseTimeout: '30m',
  startToCloseTimeout: '20m',
  heartbeatTimeout: '60s',
  retry: { maximumAttempts: 3 },
});
```

---

## Typed Signals and Queries

```typescript
import { defineSignal, defineQuery, setHandler } from '@temporalio/workflow';

// Define at module level — shared between workflow and client code
export const updatePrioritySignal = defineSignal<[{ priority: 'high' | 'low' }]>('updatePriority');
export const progressQuery = defineQuery<{ percent: number; stage: string }>('progress');

export async function processJobWorkflow(jobId: string): Promise<void> {
  let priority: 'high' | 'low' = 'low';
  let progress = { percent: 0, stage: 'queued' };

  setHandler(updatePrioritySignal, ({ priority: p }) => { priority = p; });
  setHandler(progressQuery, () => progress);

  progress = { percent: 10, stage: 'validating' };
  await validateJob(jobId);

  progress = { percent: 50, stage: 'processing' };
  await processJob(jobId);

  progress = { percent: 100, stage: 'complete' };
}
```

**Client-side signal and query**:

```typescript
const handle = client.workflow.getHandle('process-job-123');
await handle.signal(updatePrioritySignal, { priority: 'high' });
const progress = await handle.query(progressQuery);
```

---

## Condition with Timeout

```typescript
import { condition } from '@temporalio/workflow';

export async function waitForApprovalWorkflow(): Promise<'approved' | 'timed_out'> {
  let approved = false;

  setHandler(approvalSignal, () => { approved = true; });

  const timedOut = !(await condition(() => approved, '7 days'));
  return timedOut ? 'timed_out' : 'approved';
}
```

`condition()` returns `true` if the condition became true before the timeout, `false` if the timeout fired first.

---

## Compensation / Saga

```typescript
export async function sagaWorkflow(request: OrderRequest): Promise<void> {
  const compensations: Array<() => Promise<void>> = [];

  try {
    await reserveInventory(request.items);
    compensations.unshift(() => releaseInventory(request.items));

    await chargePayment(request.paymentToken, request.total);
    compensations.unshift(() => refundPayment(request.paymentToken, request.total));

    await scheduleShipment(request.address);
  } catch (err) {
    for (const compensate of compensations) {
      try {
        await compensate();
      } catch (compensationErr) {
        // Log but continue — best-effort cleanup
        console.error('Compensation failed:', compensationErr);
      }
    }
    throw err;
  }
}
```

---

## Continue-as-New

```typescript
import { continueAsNew, workflowInfo } from '@temporalio/workflow';

export interface CronState {
  iteration: number;
  lastRunTime: number;
}

export async function periodicWorkflow(state: CronState): Promise<void> {
  await doWork(state);

  state.iteration++;
  state.lastRunTime = workflow.currentTimeMillis();

  await sleep('1 hour');

  // Restart with clean history every iteration
  await continueAsNew<typeof periodicWorkflow>(state);
}
```

---

## Child Workflow with Error Handling

```typescript
import { executeChild, ChildWorkflowFailure } from '@temporalio/workflow';

export async function parentWorkflow(items: string[]): Promise<void> {
  for (const item of items) {
    try {
      await executeChild(processItemWorkflow, {
        args: [item],
        workflowId: `process-item-${item}`,
        taskQueue: 'item-processing',
      });
    } catch (err) {
      if (err instanceof ChildWorkflowFailure) {
        // Log and continue — don't fail the parent for one bad item
        console.error(`Child workflow failed for ${item}:`, err.cause?.message);
      } else {
        throw err;
      }
    }
  }
}
```

---

## Long-Running Activity with Progress Reporting

```typescript
// Activity
import { Context } from '@temporalio/activity';

export interface ProcessingDetails {
  processed: number;
  total: number;
  lastItem: string;
}

export async function processDataset(datasetId: string): Promise<void> {
  const items = await loadDataset(datasetId);
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    // Check for cancellation
    if (Context.current().cancellationSignal.aborted) {
      return; // clean exit
    }

    // Report progress every 10 items
    if (i % 10 === 0) {
      Context.current().heartbeat<ProcessingDetails>({
        processed: i,
        total,
        lastItem: items[i].id,
      });
    }

    await processItem(items[i]);
  }
}
```

```typescript
// On retry: resume from last heartbeat
export async function processDataset(datasetId: string): Promise<void> {
  const details = Context.current().heartbeatDetails as ProcessingDetails | undefined;
  const startFrom = details?.processed ?? 0;

  const items = await loadDataset(datasetId);
  for (let i = startFrom; i < items.length; i++) {
    Context.current().heartbeat<ProcessingDetails>({ processed: i, total: items.length, lastItem: items[i].id });
    await processItem(items[i]);
  }
}
```

---

## Update (Validated Signal + Query in One)

Available in newer Temporal SDK versions. Allows the sender to receive a response and validation errors synchronously.

```typescript
import { defineUpdate, setHandler } from '@temporalio/workflow';

export const addItemUpdate = defineUpdate<string, [{ itemId: string }]>('addItem');

export async function cartWorkflow(): Promise<void> {
  const items: string[] = [];

  setHandler(
    addItemUpdate,
    async ({ itemId }) => {
      items.push(itemId);
      return `Added ${itemId}`;
    },
    {
      validator: ({ itemId }) => {
        if (!itemId) throw new Error('itemId is required');
      },
    }
  );

  await condition(() => items.length >= 10 || /* checkout signal */ false, '30 days');
}
```
