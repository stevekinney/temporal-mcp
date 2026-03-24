# Go-Specific Determinism Hazards

See `references/core/determinism.md` for the general determinism contract. This file covers Go-specific hazards.

---

## Map Iteration Order

Go explicitly randomizes map iteration order. Any code that iterates a map and schedules activities or timers based on iteration order is non-deterministic.

```go
// WRONG — map iteration order is randomized each run
for k, v := range myMap {
    workflow.ExecuteActivity(ctx, processItem, k, v)
}

// RIGHT — sort keys first
keys := make([]string, 0, len(myMap))
for k := range myMap {
    keys = append(keys, k)
}
sort.Strings(keys)
for _, k := range keys {
    workflow.ExecuteActivity(ctx, processItem, k, myMap[k])
}
```

---

## Goroutines Started Outside the SDK

The Temporal Go SDK implements deterministic concurrency using coroutines on top of goroutines. Native Go goroutines (`go func() {}()`) run outside this managed scheduler and introduce real concurrency, which breaks determinism.

```go
// WRONG — native goroutine
go func() {
    workflow.ExecuteActivity(ctx, myActivity)
}()

// RIGHT — SDK-managed coroutine
workflow.Go(ctx, func(ctx workflow.Context) {
    workflow.ExecuteActivity(ctx, myActivity)
})
```

Similarly, do not use `sync.WaitGroup`, `sync.Mutex`, or `sync.Channel` directly in workflow code. Use `workflow.Channel`, `workflow.Go`, and `workflow.NewSelector` instead.

---

## `time.Now()` and `time.Sleep()`

```go
// WRONG
now := time.Now()
time.Sleep(30 * time.Second)

// RIGHT
now := workflow.Now(ctx)
workflow.Sleep(ctx, 30 * time.Second)
```

---

## `math/rand` and `crypto/rand`

```go
// WRONG
n := rand.Intn(100)

// RIGHT — use workflow's deterministic random source
r := workflow.NewRandom(ctx)
n := r.Intn(100)
```

---

## `fmt.Println`, `log.Printf`, Logging

Standard Go logging is safe (no correctness impact) but will emit on every replay, producing duplicate log lines. Use `workflow.GetLogger(ctx)` which the SDK filters to only emit during non-replay execution:

```go
// RIGHT — workflow-aware logger
logger := workflow.GetLogger(ctx)
logger.Info("Processing order", "orderID", orderID)
```

---

## Side Effects via `workflow.SideEffect`

If you need a non-deterministic value recorded once into history:

```go
var nonce string
encodedValue := workflow.SideEffect(ctx, func(ctx workflow.Context) interface{} {
    return uuid.New().String()
})
encodedValue.Get(&nonce)
// nonce is the same on every replay for this execution
```

Use `SideEffect` sparingly. The value is recorded in history on first execution and replayed from history on subsequent replays.

---

## Panics in Workflow Code

A panic in workflow code (not recovered) causes the Workflow Task to fail and be retried. If the panic is caused by non-deterministic behavior (e.g., nil pointer from unexpected state), it will panic on every retry, causing the workflow to fail repeatedly.

```go
// Avoid panicking in workflow code — return errors instead
func OrderWorkflow(ctx workflow.Context, orderID string) (string, error) {
    if orderID == "" {
        return "", temporal.NewApplicationError("orderID is required", "InvalidInput")
    }
    // ...
}
```

---

## Interfaces and Type Assertions in Workflow Code

Type assertions (`x.(ConcreteType)`) can panic if the type does not match. Use the two-value form in workflow code:

```go
// WRONG — panics if the type assertion fails
result := payload.(MyResult)

// RIGHT — check ok
result, ok := payload.(MyResult)
if !ok {
    return "", temporal.NewApplicationError("unexpected payload type", "InternalError")
}
```

---

## Closing Over Loop Variables

Go's loop variable semantics (pre-Go 1.22) means closures in workflow coroutines capture the variable by reference, not by value. This is a classic Go bug that is especially problematic in workflow code.

```go
// WRONG — all goroutines capture the same loop variable
for _, item := range items {
    workflow.Go(ctx, func(ctx workflow.Context) {
        workflow.ExecuteActivity(ctx, processItem, item) // item may be the last value
    })
}

// RIGHT — capture by value with a local variable
for _, item := range items {
    item := item // shadow with a new variable
    workflow.Go(ctx, func(ctx workflow.Context) {
        workflow.ExecuteActivity(ctx, processItem, item)
    })
}
```

In Go 1.22+, loop variables are per-iteration by default, so this is no longer an issue in recent Go versions.
