# Determinism in Temporal Workflows

## What Replay Is

Temporal persists every command a workflow issues (schedule activity, start timer, record marker, etc.) as events in an append-only event history. When a worker crashes and restarts — or when any new Workflow Task arrives — Temporal re-executes the workflow function from the beginning against the recorded history. The SDK intercepts each command the code tries to issue and compares it against the next recorded event. If the command matches, the SDK returns the already-recorded result immediately without doing any real work. Execution continues until the code reaches a point past the last recorded event, at which point the worker performs new work and records new events.

The critical consequence: your workflow function will run many times over the lifetime of a workflow. It must behave identically every time for the same history.

---

## The Determinism Contract

For any given event history, your workflow function must produce the exact same sequence of commands. The SDK tracks a "sequence number" that increments each time the workflow code issues a command. When replaying, each command the code issues must match the event at that sequence position. A mismatch — wrong command type, wrong activity name, wrong timer duration — causes the SDK to throw a non-determinism error and fail the Workflow Task.

The error usually surfaces as:

```
Nondeterminism error: history mismatch for operation ScheduleActivityTask
```

or in Python:

```
temporalio.worker._workflow_instance.NonDeterminismError: ...
```

---

## What Breaks Determinism

### Random numbers

Each replay generates a different value.

```typescript
// WRONG
const id = Math.random(); // different every replay

// RIGHT
const id = workflow.random(); // seeded by workflow run ID, same every replay
```

```python
# WRONG
import random
value = random.random()  # different every replay

# RIGHT
value = workflow.random().random()  # deterministic
```

### Wall-clock time

The current time differs between the original execution and any replay.

```typescript
// WRONG
const now = Date.now();
const today = new Date();

// RIGHT
const now = workflow.currentTimeMillis(); // returns time from workflow context
```

```python
# WRONG
from datetime import datetime
now = datetime.now()

# RIGHT
now = workflow.now()  # returns datetime from workflow context
```

### Direct I/O in workflow code

Network calls, file reads, database queries, and subprocess execution all have external side effects and non-deterministic results.

```typescript
// WRONG — never do I/O directly in a workflow
const result = await fetch('https://api.example.com/data');

// RIGHT — put I/O in an activity
const result = await executeActivity(fetchData, { scheduleToCloseTimeout: '30s' });
```

```python
# WRONG
import httpx
response = httpx.get("https://api.example.com/data")

# RIGHT
result = await workflow.execute_activity(fetch_data, schedule_to_close_timeout=timedelta(seconds=30))
```

### Non-deterministic iteration order

In older JavaScript engines, `Map` and `Set` iteration order is not guaranteed to be insertion order. In Python before 3.7, `dict` iteration order was undefined. In Go, map iteration is explicitly randomized.

```typescript
// RISKY in older engines — iteration order may differ between runs
for (const key of myMap.keys()) { ... }

// SAFE — convert to sorted array first
for (const key of [...myMap.keys()].sort()) { ... }
```

```go
// WRONG — Go map iteration is randomized
for k, v := range myMap {
    workflow.ExecuteActivity(ctx, process, k, v)
}

// RIGHT — sort keys first
keys := make([]string, 0, len(myMap))
for k := range myMap { keys = append(keys, k) }
sort.Strings(keys)
for _, k := range keys {
    workflow.ExecuteActivity(ctx, process, k, myMap[k])
}
```

### Goroutines and threads started outside the SDK

Goroutines created with `go func()` in a workflow function run outside Temporal's coroutine scheduler and introduce real concurrency, which breaks the deterministic execution model.

```go
// WRONG
go func() {
    workflow.ExecuteActivity(ctx, myActivity)
}()

// RIGHT — use workflow.Go, which is a coroutine managed by the SDK
workflow.Go(ctx, func(ctx workflow.Context) {
    workflow.ExecuteActivity(ctx, myActivity)
})
```

### Importing modules with side effects

In TypeScript, importing a module that runs code at import time (starts timers, reads environment variables, connects to a database) pollutes the deterministic replay environment. Workflow bundles must be side-effect free.

### Catching and ignoring SDK-thrown errors

SDK errors like `CancelledError` are part of the recorded history. If your code catches and silently swallows them, the replay produces a different command sequence than the original execution.

```typescript
// WRONG — swallowing CancelledError changes the command sequence
try {
    await executeActivity(myActivity, opts);
} catch (e) {
    // do nothing — this hides the cancellation from the history
}

// RIGHT — re-throw or handle explicitly
try {
    await executeActivity(myActivity, opts);
} catch (e) {
    if (isCancellation(e)) throw e; // propagate cancellation
    // handle other errors
}
```

---

## Safe Alternatives

| Instead of | Use |
|-----------|-----|
| `Date.now()` | `workflow.currentTimeMillis()` (TS) / `workflow.now()` (Python) / `workflow.Now(ctx)` (Go) |
| `Math.random()` | `workflow.random()` (TS) / `workflow.random().random()` (Python) / `workflow.NewRandom(ctx)` (Go) |
| `setTimeout` / `asyncio.sleep` | `workflow.sleep()` (TS/Python) / `workflow.Sleep(ctx, duration)` (Go) |
| Direct I/O | Activities |
| Truly necessary one-time non-deterministic values | `workflow.sideEffect()` (TS) / `workflow.side_effect()` (Python) / `workflow.SideEffect(ctx, ...)` (Go) |
| Unsorted map/set iteration | Sort keys before iterating |

### `sideEffect` — when you truly need one non-deterministic value

Side effects record the value into history on first execution. On replay, the recorded value is returned without re-running the function.

```typescript
// TypeScript
const nonce = await workflow.sideEffect<string>(() => crypto.randomUUID());
```

```python
# Python
nonce = await workflow.side_effect(lambda: str(uuid.uuid4()))
```

```go
// Go
var nonce string
workflow.SideEffect(ctx, func(ctx workflow.Context) interface{} {
    return uuid.New().String()
}).Get(&nonce)
```

Use `sideEffect` sparingly. If the value drives activity scheduling or timer durations, it must be recorded before those commands are issued.

---

## Common Replay Error Messages

| Message | Cause |
|---------|-------|
| `Nondeterminism error: history mismatch for operation ScheduleActivityTask` | Activity was added, removed, or renamed without a patch |
| `Nondeterminism error: history mismatch for operation StartTimer` | Timer duration changed or timer was added/removed without a patch |
| `Nondeterminism error: history mismatch for operation RecordMarker` | A `sideEffect` or `patch` marker was added or removed |
| `NonDeterminismError` (Python) | Any mismatch between code and recorded history |
| `ErrNondeterministicCode` (Go) | Any mismatch between code and recorded history |

---

## How to Debug Non-Determinism

1. Use the `temporal.workflow.history` MCP tool to fetch the complete event history for the failing workflow execution.
2. Look for the event sequence number where the error was thrown — the error message often includes the event ID.
3. Find the `ScheduleActivityTask`, `StartTimer`, or `RecordMarker` event at that position.
4. Compare what the recorded event contains (activity type, input, timer duration) against what your current code would issue at that point.
5. The mismatch tells you exactly what changed: an activity was renamed, a timer was added before an existing one, a patch marker was removed prematurely.
6. Apply a `patched()` / `workflow.GetVersion()` guard around the changed code — see `references/core/versioning.md`.
