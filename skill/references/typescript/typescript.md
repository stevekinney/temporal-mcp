# Temporal TypeScript SDK

## Setup

```sh
npm install @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity
```

Or with Bun:

```sh
bun add @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity
```

## Project Structure

```
src/
  workflows/
    index.ts          # workflow definitions (runs in isolated VM)
  activities/
    index.ts          # activity implementations (runs in Node.js/Bun)
  worker.ts           # worker bootstrap
  client.ts           # client bootstrap (for starting workflows)
```

Workflows and activities are loaded by separate module paths. The worker bundles workflow code into a sandboxed V8 isolate. Activity code runs in the normal Node.js/Bun environment.

## Worker Bootstrap

```typescript
import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';

async function main() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
    taskQueue: 'my-task-queue',
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  await worker.run();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Workflow Definition

```typescript
// src/workflows/index.ts
import { defineSignal, defineQuery, setHandler, condition, executeActivity, proxyActivities } from '@temporalio/workflow';
import type * as Activities from '../activities';

// Proxy activities — this is the ONLY way to call activities from a workflow
const { processOrder, sendNotification } = proxyActivities<typeof Activities>({
  scheduleToCloseTimeout: '5m',
  startToCloseTimeout: '1m',
  retry: {
    maximumAttempts: 3,
  },
});

export const cancelSignal = defineSignal('cancel');
export const statusQuery = defineQuery<string>('status');

export async function orderWorkflow(orderId: string): Promise<string> {
  let status = 'pending';
  let cancelled = false;

  setHandler(cancelSignal, () => { cancelled = true; });
  setHandler(statusQuery, () => status);

  if (cancelled) return 'cancelled';

  status = 'processing';
  const result = await processOrder(orderId);

  status = 'notifying';
  await sendNotification(result.customerId, result.message);

  status = 'complete';
  return result.orderId;
}
```

## Activity Definition

```typescript
// src/activities/index.ts
import { Context } from '@temporalio/activity';

export async function processOrder(orderId: string): Promise<{ customerId: string; message: string; orderId: string }> {
  // Activities run in normal Node.js/Bun — you can do I/O here
  Context.current().heartbeat({ orderId, step: 'processing' });

  const order = await db.orders.findById(orderId);
  if (!order) {
    throw ApplicationFailure.nonRetryable(`Order ${orderId} not found`, 'NotFound');
  }

  // ... process the order
  return { customerId: order.customerId, message: 'Order processed', orderId };
}
```

## Client Bootstrap

```typescript
import { Client, Connection } from '@temporalio/client';

async function startWorkflow() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  });

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
  });

  const handle = await client.workflow.start(orderWorkflow, {
    taskQueue: 'my-task-queue',
    workflowId: `order-${orderId}`,
    args: [orderId],
  });

  console.log(`Started workflow ${handle.workflowId}`);
  const result = await handle.result();
  console.log('Result:', result);
}
```

## Temporal Cloud Connection

```typescript
import { NativeConnection } from '@temporalio/worker';
import { readFileSync } from 'fs';

const connection = await NativeConnection.connect({
  address: 'your-namespace.tmprl.cloud:7233',
  tls: {
    clientCertPair: {
      crt: readFileSync('client.pem'),
      key: readFileSync('client.key'),
    },
  },
});
```

## Key TypeScript-Specific Notes

- **Never import Node.js built-ins (`fs`, `net`, `http`) in workflow files.** They are not available in the workflow isolate and will cause errors.
- **`proxyActivities` is required.** Calling activity functions directly in a workflow does not go through the Temporal SDK and breaks determinism.
- **Workflow code is bundled** by the SDK's WebPack bundler at worker startup. Any module with side effects will break this. See `references/typescript/determinism.md`.
- **`import type`** is safe in workflow files — type-only imports are erased at compile time.
