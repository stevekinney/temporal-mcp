# TypeScript-Specific Determinism Hazards

See `references/core/determinism.md` for the general determinism contract. This file covers TypeScript and Node.js specific hazards.

---

## Promise Ordering

In JavaScript, microtask ordering is determined by when Promises resolve. If two activities complete "simultaneously" during replay, the order in which their `.then` callbacks run depends on the microtask queue state — which can differ between execution and replay.

**WRONG**:

```typescript
// Indeterminate order — Promise.race resolves with whichever completes first
const result = await Promise.race([activityA(), activityB()]);
```

**RIGHT**:

```typescript
// Explicit: run A, then run B — always the same order
const resultA = await activityA();
const resultB = await activityB();
```

For parallel execution, use `Promise.all` (not `Promise.race`) and process results in index order.

---

## `Date` Object and `date-fns` / `dayjs` / `luxon`

Any call that reads the current time is non-deterministic.

```typescript
// WRONG — all of these read wall-clock time
const now = new Date();
const ts = Date.now();
const iso = new Date().toISOString();
const formatted = format(new Date(), 'yyyy-MM-dd'); // date-fns
const m = moment();                                   // moment.js

// RIGHT — use workflow context time
import { workflowInfo } from '@temporalio/workflow';
const now = new Date(workflow.currentTimeMillis());
```

If you use date manipulation libraries inside workflow code, always construct the `Date` from `workflow.currentTimeMillis()`, never from `new Date()` or `Date.now()`.

---

## `Math.random()`

```typescript
// WRONG
const id = Math.random().toString(36).substring(2);

// RIGHT
import { randomUUID } from '@temporalio/workflow';
const id = randomUUID(); // deterministic, seeded by run ID
```

Or use `workflow.sideEffect()` if you need a one-time random value recorded in history.

---

## Modules with Side Effects at Import Time

The TypeScript SDK bundles workflow code into a V8 isolate. If any imported module runs code at module evaluation time (connects to a database, starts a background timer, reads environment variables and throws), that code runs during replay — with unpredictable results.

```typescript
// WRONG in workflow files — these modules have side effects at import
import Redis from 'ioredis';         // connects at import
import { pool } from './db-pool';    // creates DB connection pool at import

// RIGHT — put all such initialization in activities, never in workflows
// In workflows, only import pure functions and SDK primitives
import { proxyActivities } from '@temporalio/workflow';
```

Use `// @ts-ignore` and the SDK's `bundlerOptions.ignoreModules` if you must import a module that has side effects but you only use type-safe parts of it.

---

## `async/await` and Generator Ordering

The TypeScript SDK uses coroutine-style scheduling internally. Each `await` is a yield point. The order of `await` calls determines the command sequence. Changing the order of awaits in workflow code — even within a `try/catch` — changes the command sequence and can break replay.

```typescript
// WRONG — reordering awaits breaks the command sequence for existing executions
export async function myWorkflow(): Promise<void> {
  // Original code:
  await executeActivity(activityA, opts);
  await executeActivity(activityB, opts);
}

// New code (BREAKS EXISTING EXECUTIONS):
export async function myWorkflow(): Promise<void> {
  await executeActivity(activityB, opts);  // swapped order
  await executeActivity(activityA, opts);
}
```

Use `patched()` to add version branches when reordering.

---

## `setTimeout` and `setInterval`

These are replaced with no-ops in the workflow isolate. They do not behave like real timers.

```typescript
// WRONG — setTimeout does nothing or behaves unexpectedly in workflow isolate
setTimeout(() => { console.log('never runs correctly'); }, 1000);

// RIGHT — use workflow.sleep()
import { sleep } from '@temporalio/workflow';
await sleep('1 second');
```

---

## `console.log` in Workflow Code

`console.log` in workflow code will execute on every replay. This is not a correctness issue, but it can produce very noisy logs. Prefer structured logging with `defaultValue` guards or move logging to activities.

---

## Environment Variables in Workflow Code

`process.env` reads environment variables at execution time. The value at replay time may differ from the original execution time if the environment changed between deployments.

```typescript
// RISKY — env var may be different on replay
const endpoint = process.env.API_ENDPOINT;
await executeActivity(callApi, { endpoint });

// RIGHT — read env vars in activities or pass as workflow input
// The workflow input is recorded in history and replayed deterministically
export async function myWorkflow(config: WorkflowConfig): Promise<void> {
  await executeActivity(callApi, { endpoint: config.apiEndpoint });
}
```

---

## TypeScript Bundler and Module Resolution

The Temporal TypeScript SDK uses webpack (or its internal bundler) to bundle workflow code. This has implications:

- **Dynamic `require()` and `import()` are not supported** inside workflow code.
- **`__dirname` and `__filename`** are not available in the workflow bundle.
- **Circular imports** can cause issues during bundling. Keep workflow files lean.
- **Large dependencies** included in the workflow bundle increase worker startup time. Only import what you need.

Add modules that should be excluded from the workflow bundle to `bundlerOptions.ignoreModules` in the worker configuration:

```typescript
const worker = await Worker.create({
  // ...
  bundlerOptions: {
    ignoreModules: ['some-module-with-side-effects'],
  },
});
```
