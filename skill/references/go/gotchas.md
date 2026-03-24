# Go-Specific Gotchas

---

## Activity Context vs Workflow Context

Activities receive a standard `context.Context`. Workflow functions receive a `workflow.Context`. These are not the same type and cannot be used interchangeably.

```go
// Activity — uses context.Context
func ProcessOrder(ctx context.Context, orderID string) (OrderResult, error) {
    activity.RecordHeartbeat(ctx, orderID)
    // ctx is cancelled on heartbeat timeout or workflow cancellation
    return OrderResult{}, nil
}

// Workflow — uses workflow.Context
func OrderWorkflow(ctx workflow.Context, orderID string) (string, error) {
    actOpts := workflow.ActivityOptions{...}
    ctx = workflow.WithActivityOptions(ctx, actOpts)
    workflow.ExecuteActivity(ctx, ProcessOrder, orderID)
    return "", nil
}
```

Inside an activity, always use the provided `context.Context` for sub-calls (HTTP clients, database connections, etc.) so cancellation propagates correctly. Never create `context.Background()` or `context.TODO()` inside an activity for long operations.

---

## Panic Handling in Activities

Go panics in activities are recovered by the SDK and converted to application errors. However, panics that indicate programming errors (nil pointer dereference, index out of bounds) will keep retrying with the same panic unless the retry policy is set appropriately.

```go
// WRONG — panic from nil pointer will retry indefinitely
func MyActivity(ctx context.Context, input *MyInput) error {
    return doWork(input.Field) // panics if input is nil
}

// RIGHT — validate inputs and return errors instead
func MyActivity(ctx context.Context, input *MyInput) error {
    if input == nil {
        return temporal.NewNonRetryableApplicationError("input is required", "InvalidInput", nil)
    }
    return doWork(input.Field)
}
```

---

## Registering Workflows and Activities

Every workflow function and activity function that a worker might execute **must be registered** before calling `w.Run()`. Forgetting a registration causes the task to be retried indefinitely on workers that don't have the function registered.

```go
w := worker.New(c, "my-task-queue", worker.Options{})

// Register all workflows
w.RegisterWorkflow(OrderWorkflow)
w.RegisterWorkflow(FulfillmentWorkflow)

// Register all activities — even activities called from child workflows
w.RegisterActivity(ProcessOrder)
w.RegisterActivity(SendNotification)
w.RegisterActivity(ShipOrder)

w.Run(worker.InterruptCh())
```

If multiple workers handle the same task queue, each must register the same set of workflows and activities (or use build ID versioning to route specific workflows to specific workers).

---

## Workflow Function Signature

Workflow functions must follow a specific signature:

```go
// Valid — takes workflow.Context and returns (T, error) or just error
func MyWorkflow(ctx workflow.Context) error
func MyWorkflow(ctx workflow.Context, input string) (string, error)
func MyWorkflow(ctx workflow.Context, input MyInput) (MyOutput, error)

// Invalid — missing workflow.Context
func MyWorkflow(input string) (string, error)

// Invalid — multiple return values beyond (T, error)
func MyWorkflow(ctx workflow.Context) (string, int, error)
```

Activity functions must take a `context.Context` as the first argument:

```go
// Valid
func MyActivity(ctx context.Context) error
func MyActivity(ctx context.Context, input string) (string, error)

// Invalid — missing context
func MyActivity(input string) (string, error)
```

---

## `workflow.Go` and Error Handling

`workflow.Go` coroutines cannot return errors to the caller. Use a channel or shared variable to collect errors.

```go
func FanOutWorkflow(ctx workflow.Context, items []string) error {
    actOpts := workflow.ActivityOptions{ScheduleToCloseTimeout: 30 * time.Second}
    ctx = workflow.WithActivityOptions(ctx, actOpts)

    type result struct {
        index int
        err   error
    }
    resultCh := workflow.NewBufferedChannel(ctx, len(items))

    for i, item := range items {
        i, item := i, item
        workflow.Go(ctx, func(ctx workflow.Context) {
            err := workflow.ExecuteActivity(ctx, ProcessItem, item).Get(ctx, nil)
            resultCh.Send(ctx, result{index: i, err: err})
        })
    }

    for range items {
        var r result
        resultCh.Receive(ctx, &r)
        if r.err != nil {
            return fmt.Errorf("item %d failed: %w", r.index, r.err)
        }
    }
    return nil
}
```

---

## `workflow.Selector` for Complex Concurrency

When waiting for multiple events (signals, timers, activity futures) and the order matters, use `workflow.NewSelector`:

```go
selector := workflow.NewSelector(ctx)

// Add multiple futures/channels
selector.AddFuture(actFuture, func(f workflow.Future) {
    f.Get(ctx, &actResult)
})
selector.AddReceive(signalCh, func(c workflow.ReceiveChannel, more bool) {
    c.Receive(ctx, &signalPayload)
})

// Select blocks until one is ready, then calls that handler
selector.Select(ctx)
```

`Select` only fires one handler per call. Loop around it if you need to handle multiple events.

---

## Worker Graceful Shutdown

```go
w := worker.New(c, "my-task-queue", worker.Options{})
w.RegisterWorkflow(MyWorkflow)
w.RegisterActivity(MyActivity)

// Run blocks until InterruptCh is closed (SIGINT/SIGTERM)
// or w.Stop() is called from another goroutine
if err := w.Run(worker.InterruptCh()); err != nil {
    log.Fatalf("Worker failed: %v", err)
}
```

Sending SIGTERM triggers graceful drain. The worker stops accepting new tasks and waits for in-flight tasks to complete (up to the deadline). `SIGKILL` bypasses drain — avoid it in production.

---

## Testing with the Test Suite

```go
import (
    "testing"
    "github.com/stretchr/testify/require"
    "go.temporal.io/sdk/testsuite"
)

func TestOrderWorkflow(t *testing.T) {
    suite := testsuite.WorkflowTestSuite{}
    env := suite.NewTestWorkflowEnvironment()

    env.RegisterWorkflow(OrderWorkflow)
    env.RegisterActivity(ProcessOrder)
    env.RegisterActivity(SendNotification)

    // Mock an activity
    env.OnActivity(ProcessOrder, mock.Anything, "order-123").
        Return(OrderResult{OrderID: "order-123", CustomerID: "cust-1", Message: "done"}, nil)

    env.ExecuteWorkflow(OrderWorkflow, "order-123")

    require.True(t, env.IsWorkflowCompleted())
    require.NoError(t, env.GetWorkflowError())

    var result string
    require.NoError(t, env.GetWorkflowResult(&result))
    require.Equal(t, "order-123", result)
}
```

The test environment skips time automatically for `workflow.Sleep` calls. No real clock time is consumed.
