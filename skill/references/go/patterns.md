# Go Workflow and Activity Patterns

---

## Activity Options and Retry Policy

```go
func OrderWorkflow(ctx workflow.Context, orderID string) (string, error) {
    // Fast activities
    fastOpts := workflow.ActivityOptions{
        ScheduleToCloseTimeout: 10 * time.Second,
        StartToCloseTimeout:    5 * time.Second,
        RetryPolicy: &temporal.RetryPolicy{
            MaximumAttempts: 2,
        },
    }

    // Slow activities with heartbeat
    slowOpts := workflow.ActivityOptions{
        ScheduleToCloseTimeout: 30 * time.Minute,
        StartToCloseTimeout:    20 * time.Minute,
        HeartbeatTimeout:       60 * time.Second,
        RetryPolicy: &temporal.RetryPolicy{
            InitialInterval:    2 * time.Second,
            BackoffCoefficient: 2.0,
            MaximumInterval:    30 * time.Second,
            MaximumAttempts:    5,
        },
    }

    fastCtx := workflow.WithActivityOptions(ctx, fastOpts)
    slowCtx := workflow.WithActivityOptions(ctx, slowOpts)

    var validateResult ValidationResult
    if err := workflow.ExecuteActivity(fastCtx, ValidateOrder, orderID).Get(fastCtx, &validateResult); err != nil {
        return "", err
    }

    var processResult ProcessResult
    if err := workflow.ExecuteActivity(slowCtx, ProcessOrder, orderID).Get(slowCtx, &processResult); err != nil {
        return "", err
    }

    return processResult.ConfirmationNumber, nil
}
```

---

## Signals and Queries

```go
func ApprovalWorkflow(ctx workflow.Context, requestID string) (string, error) {
    approvalCh := workflow.GetSignalChannel(ctx, "approval")
    statusQuery := "getStatus"
    status := "pending"

    if err := workflow.SetQueryHandler(ctx, statusQuery, func() (string, error) {
        return status, nil
    }); err != nil {
        return "", err
    }

    // Wait up to 7 days for an approval signal
    timerCtx, cancelTimer := workflow.WithCancel(ctx)
    timer := workflow.NewTimer(timerCtx, 7*24*time.Hour)

    type ApprovalPayload struct {
        Approved bool   `json:"approved"`
        Comment  string `json:"comment"`
    }

    selector := workflow.NewSelector(ctx)
    var approvalPayload ApprovalPayload
    var timedOut bool

    selector.AddReceive(approvalCh, func(c workflow.ReceiveChannel, more bool) {
        c.Receive(ctx, &approvalPayload)
        cancelTimer()
    })
    selector.AddFuture(timer, func(f workflow.Future) {
        timedOut = true
    })
    selector.Select(ctx)

    if timedOut {
        return "timed_out", nil
    }

    status = "decided"
    if approvalPayload.Approved {
        return "approved", nil
    }
    return "rejected", nil
}
```

---

## Fan-out / Fan-in

```go
func BatchWorkflow(ctx workflow.Context, itemIDs []string) ([]string, error) {
    actOpts := workflow.ActivityOptions{
        ScheduleToCloseTimeout: 60 * time.Second,
    }
    ctx = workflow.WithActivityOptions(ctx, actOpts)

    futures := make([]workflow.Future, len(itemIDs))
    for i, id := range itemIDs {
        futures[i] = workflow.ExecuteActivity(ctx, ProcessItem, id)
    }

    results := make([]string, len(itemIDs))
    for i, f := range futures {
        if err := f.Get(ctx, &results[i]); err != nil {
            return nil, fmt.Errorf("item %s failed: %w", itemIDs[i], err)
        }
    }
    return results, nil
}
```

---

## Saga / Compensating Transactions

```go
func BookTravelWorkflow(ctx workflow.Context, trip TripRequest) error {
    actOpts := workflow.ActivityOptions{
        ScheduleToCloseTimeout: 30 * time.Second,
    }
    ctx = workflow.WithActivityOptions(ctx, actOpts)

    var compensations []func() error

    compensate := func() {
        for i := len(compensations) - 1; i >= 0; i-- {
            if err := compensations[i](); err != nil {
                workflow.GetLogger(ctx).Error("Compensation failed", "error", err)
            }
        }
    }

    if err := workflow.ExecuteActivity(ctx, BookFlight, trip.FlightID).Get(ctx, nil); err != nil {
        return err
    }
    compensations = append(compensations, func() error {
        return workflow.ExecuteActivity(ctx, CancelFlight, trip.FlightID).Get(ctx, nil)
    })

    if err := workflow.ExecuteActivity(ctx, BookHotel, trip.HotelID).Get(ctx, nil); err != nil {
        compensate()
        return err
    }
    compensations = append(compensations, func() error {
        return workflow.ExecuteActivity(ctx, CancelHotel, trip.HotelID).Get(ctx, nil)
    })

    if err := workflow.ExecuteActivity(ctx, ChargeCard, trip.CardToken, trip.Total).Get(ctx, nil); err != nil {
        compensate()
        return err
    }

    return nil
}
```

---

## Child Workflows

```go
func ParentWorkflow(ctx workflow.Context, orderIDs []string) error {
    childOpts := workflow.ChildWorkflowOptions{
        TaskQueue: "order-processing",
    }

    for _, orderID := range orderIDs {
        childOpts.WorkflowID = "process-order-" + orderID
        childCtx := workflow.WithChildOptions(ctx, childOpts)

        var result OrderResult
        err := workflow.ExecuteChildWorkflow(childCtx, ProcessOrderWorkflow, orderID).Get(childCtx, &result)
        if err != nil {
            var childErr *temporal.ChildWorkflowExecutionError
            if errors.As(err, &childErr) {
                workflow.GetLogger(ctx).Error("Child workflow failed", "orderID", orderID, "cause", childErr.Unwrap())
                continue
            }
            return err
        }
    }
    return nil
}
```

---

## Continue-as-New

```go
type PollerState struct {
    ProcessedCount int
    LastCursor     string
}

func PollerWorkflow(ctx workflow.Context, state PollerState) error {
    actOpts := workflow.ActivityOptions{
        ScheduleToCloseTimeout: 5 * time.Minute,
    }
    ctx = workflow.WithActivityOptions(ctx, actOpts)

    var result PollResult
    if err := workflow.ExecuteActivity(ctx, PollAndProcess, state.LastCursor).Get(ctx, &result); err != nil {
        return err
    }

    state.ProcessedCount += result.Count
    state.LastCursor = result.NextCursor

    if state.ProcessedCount%500 == 0 {
        return workflow.NewContinueAsNewError(ctx, PollerWorkflow, state)
    }

    workflow.Sleep(ctx, 1*time.Minute)
    return workflow.NewContinueAsNewError(ctx, PollerWorkflow, state)
}
```

---

## Long-Running Activity with Heartbeat and Resume

```go
func ProcessDataset(ctx context.Context, datasetID string) (int, error) {
    // Resume from last heartbeat details on retry
    var startFrom int
    if activity.HasHeartbeatDetails(ctx) {
        activity.GetHeartbeatDetails(ctx, &startFrom)
    }

    records, err := loadRecords(ctx, datasetID)
    if err != nil {
        return 0, err
    }

    for i := startFrom; i < len(records); i++ {
        if ctx.Err() != nil {
            return i, temporal.NewCanceledError()
        }

        if i%50 == 0 {
            activity.RecordHeartbeat(ctx, i)
        }

        if err := processRecord(ctx, records[i]); err != nil {
            return i, err
        }
    }
    return len(records), nil
}
```
