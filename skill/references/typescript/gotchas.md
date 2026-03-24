# TypeScript-Specific Gotchas

---

## Bundling: Workflow Code Must Be Side-Effect Free

The Temporal TypeScript SDK bundles your workflow files into a V8 isolate using webpack. Any module imported (directly or transitively) by your workflow file that runs code at import time will be executed inside this isolate.

**Common failures**:

```typescript
// WRONG — these modules connect, read files, or throw at import time in the isolate
import { pool } from '../database';          // creates DB connection
import { config } from '../configuration';   // reads process.env and validates
import Redis from 'ioredis';                 // opens Redis connection

// RIGHT — only import SDK primitives and pure type definitions in workflow files
import { proxyActivities, defineSignal } from '@temporalio/workflow';
import type { MyActivities } from '../activities';  // type-only import is safe
```

If a transitive dependency causes issues, use `bundlerOptions.ignoreModules`:

```typescript
const worker = await Worker.create({
  workflowsPath: require.resolve('./workflows'),
  bundlerOptions: {
    ignoreModules: ['pg', 'ioredis', 'some-problematic-module'],
  },
});
```

---

## Module Resolution: `require.resolve` vs Import Path

The `workflowsPath` in `Worker.create` must be an absolute path resolved at runtime:

```typescript
// RIGHT
workflowsPath: require.resolve('./workflows'),

// WRONG — relative paths are not reliable
workflowsPath: './workflows',
workflowsPath: './src/workflows/index.ts',
```

With Bun, you can use `import.meta.resolve`:

```typescript
workflowsPath: new URL('./workflows', import.meta.url).pathname,
```

---

## Type Errors with Activity Proxies

`proxyActivities` uses the TypeScript type parameter to provide type-safe activity calls. If you see type errors on activity calls, ensure you are passing the correct type:

```typescript
// RIGHT — use typeof Activities (the module namespace)
import type * as Activities from '../activities';
const acts = proxyActivities<typeof Activities>({ scheduleToCloseTimeout: '30s' });

// WRONG — Activities is an interface, not a module namespace
interface Activities { myActivity(input: string): Promise<string>; }
const acts = proxyActivities<Activities>({ scheduleToCloseTimeout: '30s' });
// This works for calling but the SDK needs the actual module for registration
```

---

## `ApplicationFailure` Import Location

`ApplicationFailure` is exported from two packages. Use the correct one depending on context:

```typescript
// In workflow code:
import { ApplicationFailure } from '@temporalio/workflow';

// In activity code or non-workflow code:
import { ApplicationFailure } from '@temporalio/activity';
// or from the common package:
import { ApplicationFailure } from '@temporalio/common';
```

---

## Signal Handler Must Be Synchronous

Signal handlers registered with `setHandler` must not be `async` and must not call `await`. If you need to schedule work in response to a signal, set a flag and let the main workflow body react to it.

```typescript
// WRONG — async signal handler
setHandler(mySignal, async (payload) => {
  await executeActivity(handleSignal, payload); // WRONG
});

// RIGHT — set state in handler, react in main body
let pendingSignalPayload: MyPayload | undefined;
setHandler(mySignal, (payload) => { pendingSignalPayload = payload; });

while (true) {
  await condition(() => pendingSignalPayload !== undefined);
  const payload = pendingSignalPayload!;
  pendingSignalPayload = undefined;
  await executeActivity(handleSignal, payload); // RIGHT — called from main body
}
```

---

## Catching `CancelledFailure` Correctly

When a workflow is cancelled, `CancelledFailure` is thrown at the next `await` point. Use `isCancellation()` to detect it without importing the class directly.

```typescript
import { isCancellation } from '@temporalio/workflow';

try {
  await executeActivity(longActivity, opts);
} catch (err) {
  if (isCancellation(err)) {
    // Run cleanup then re-throw to mark workflow as CANCELED
    await executeActivity(cleanupActivity, { ...opts });
    throw err;
  }
  throw err;
}
```

If you catch all errors and do not re-throw `CancelledFailure`, the workflow will complete as COMPLETED rather than CANCELED.

---

## Worker Registration: Workflows vs Activities

Activities are passed as a plain object. Workflows are discovered from the workflow bundle. You do not explicitly register individual workflow functions — they are all included when you set `workflowsPath`.

```typescript
// Activities — pass the module object directly
import * as activities from './activities';

const worker = await Worker.create({
  activities,           // all exported functions become activities
  workflowsPath: require.resolve('./workflows'),  // all exports become workflow types
});
```

If an activity is not exported from the module passed to `activities`, the worker will not handle it and the workflow will get stuck at `ActivityTaskScheduled`.

---

## TypeScript and ESM / CommonJS Compatibility

The Temporal TypeScript SDK works best with CommonJS. If you are using ESM (`"type": "module"` in `package.json`), you may encounter issues with `require.resolve` and the webpack bundler.

**Recommendation**: Keep workflow and worker code in CommonJS format even if the rest of your project uses ESM. Use a separate `tsconfig.json` with `"module": "commonjs"` for worker code.

---

## Testing: Use `@temporalio/testing` Not Real Temporal

```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { myWorkflow } from './workflows';
import * as activities from './activities';

let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
});

afterAll(async () => {
  await testEnv.teardown();
});

test('myWorkflow completes', async () => {
  const { client, nativeConnection } = testEnv;

  const worker = await Worker.create({
    connection: nativeConnection,
    taskQueue: 'test',
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  const result = await worker.runUntil(
    client.workflow.execute(myWorkflow, {
      taskQueue: 'test',
      workflowId: 'test-run',
      args: ['input'],
    })
  );

  expect(result).toBe('expected-output');
});
```

Use `createTimeSkipping()` for workflows that use `sleep()` — it completes in milliseconds instead of waiting real time.
