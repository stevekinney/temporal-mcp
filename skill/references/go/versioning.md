# Go Workflow Versioning

See `references/core/versioning.md` for the general versioning strategy. This file has Go-specific examples.

---

## `workflow.GetVersion()`

Go uses `workflow.GetVersion` to add version branches. It takes a change ID string, a minimum supported version, and a maximum supported version. The SDK records the version in history on first execution. On replay, the recorded version is returned.

```go
import "go.temporal.io/sdk/workflow"

// workflow.DefaultVersion = -1 (means "no version recorded")
```

### Phase 1: Add the Version Branch

Deploy while old workflow executions (with `DefaultVersion` in history) are still running:

```go
func FulfillOrderWorkflow(ctx workflow.Context, orderID string) error {
    actOpts := workflow.ActivityOptions{ScheduleToCloseTimeout: 5 * time.Minute}
    ctx = workflow.WithActivityOptions(ctx, actOpts)

    if err := workflow.ExecuteActivity(ctx, ValidateOrder, orderID).Get(ctx, nil); err != nil {
        return err
    }

    // Add a version branch for the fraud check
    v := workflow.GetVersion(ctx, "add-fraud-check", workflow.DefaultVersion, 1)
    if v == 1 {
        // New path: fraud check before payment
        if err := workflow.ExecuteActivity(ctx, RunFraudCheck, orderID).Get(ctx, nil); err != nil {
            return err
        }
    }
    // Old path (v == DefaultVersion): no fraud check

    if err := workflow.ExecuteActivity(ctx, ProcessPayment, orderID).Get(ctx, nil); err != nil {
        return err
    }

    return workflow.ExecuteActivity(ctx, ShipOrder, orderID).Get(ctx, nil)
}
```

### Phase 2: Drop the Old Path

Deploy after all executions running the old path (v == DefaultVersion) have completed. Raise the minimum version to 1 to indicate the old path is no longer supported.

```go
func FulfillOrderWorkflow(ctx workflow.Context, orderID string) error {
    actOpts := workflow.ActivityOptions{ScheduleToCloseTimeout: 5 * time.Minute}
    ctx = workflow.WithActivityOptions(ctx, actOpts)

    if err := workflow.ExecuteActivity(ctx, ValidateOrder, orderID).Get(ctx, nil); err != nil {
        return err
    }

    // Minimum version is now 1 — old executions without this marker will fail (they should be drained)
    workflow.GetVersion(ctx, "add-fraud-check", 1, 1)
    // No branching — always runs the fraud check

    if err := workflow.ExecuteActivity(ctx, RunFraudCheck, orderID).Get(ctx, nil); err != nil {
        return err
    }

    if err := workflow.ExecuteActivity(ctx, ProcessPayment, orderID).Get(ctx, nil); err != nil {
        return err
    }

    return workflow.ExecuteActivity(ctx, ShipOrder, orderID).Get(ctx, nil)
}
```

### Phase 3: Remove the Version Check

Deploy after all executions that ran Phase 2 have completed. The code is clean.

```go
func FulfillOrderWorkflow(ctx workflow.Context, orderID string) error {
    actOpts := workflow.ActivityOptions{ScheduleToCloseTimeout: 5 * time.Minute}
    ctx = workflow.WithActivityOptions(ctx, actOpts)

    if err := workflow.ExecuteActivity(ctx, ValidateOrder, orderID).Get(ctx, nil); err != nil {
        return err
    }
    if err := workflow.ExecuteActivity(ctx, RunFraudCheck, orderID).Get(ctx, nil); err != nil {
        return err
    }
    if err := workflow.ExecuteActivity(ctx, ProcessPayment, orderID).Get(ctx, nil); err != nil {
        return err
    }
    return workflow.ExecuteActivity(ctx, ShipOrder, orderID).Get(ctx, nil)
}
```

---

## Multiple Version Gates

Each independent change gets its own change ID. Manage each independently.

```go
func OrderWorkflow(ctx workflow.Context, orderID string) error {
    actOpts := workflow.ActivityOptions{ScheduleToCloseTimeout: 5 * time.Minute}
    ctx = workflow.WithActivityOptions(ctx, actOpts)

    // Gate 1: validation step added in v2
    v1 := workflow.GetVersion(ctx, "add-validation-v1", workflow.DefaultVersion, 1)
    if v1 == 1 {
        if err := workflow.ExecuteActivity(ctx, ValidateOrder, orderID).Get(ctx, nil); err != nil {
            return err
        }
    }

    if err := workflow.ExecuteActivity(ctx, ProcessOrder, orderID).Get(ctx, nil); err != nil {
        return err
    }

    // Gate 2: two-phase shipping added in v3
    v2 := workflow.GetVersion(ctx, "two-phase-shipping-v1", workflow.DefaultVersion, 1)
    if v2 == 1 {
        if err := workflow.ExecuteActivity(ctx, ReserveShipment, orderID).Get(ctx, nil); err != nil {
            return err
        }
        return workflow.ExecuteActivity(ctx, ConfirmShipment, orderID).Get(ctx, nil)
    }
    return workflow.ExecuteActivity(ctx, ShipOrder, orderID).Get(ctx, nil)
}
```

---

## Worker Versioning with Build IDs

```go
w := worker.New(c, "order-processing", worker.Options{
    BuildID:                 os.Getenv("BUILD_ID"), // e.g., "v1.2.0" or git SHA
    UseBuildIDForVersioning: true,
})
```

Promote a build ID to default for new executions:

```sh
temporal task-queue update-build-ids promote-id-to-current \
  --task-queue order-processing \
  --build-id v1.2.0
```

Old executions that started on `v1.1.0` continue to be handled by workers running that build ID. New executions are routed to `v1.2.0`.

---

## Replay Testing

Use the SDK's `worker.WorkflowReplayer` to verify that new code replays old histories without non-determinism errors before deploying:

```go
import (
    "go.temporal.io/sdk/worker"
    "os"
)

func TestReplay(t *testing.T) {
    replayer := worker.NewWorkflowReplayer()
    replayer.RegisterWorkflow(OrderWorkflow)

    // Download history JSON from cluster using temporal.workflow.history MCP tool or CLI
    historyJSON, err := os.ReadFile("testdata/order-workflow-history.json")
    require.NoError(t, err)

    err = replayer.ReplayWorkflowHistoryFromJSON(nil, bytes.NewReader(historyJSON))
    require.NoError(t, err, "Workflow replay must succeed with new code")
}
```

Run replay tests in CI for every workflow code change. If replay fails, the change breaks existing executions and needs a `GetVersion` guard.
