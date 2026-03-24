# Temporal Go SDK

## Setup

```sh
go get go.temporal.io/sdk
```

## Project Structure

```
cmd/
  worker/main.go       # worker bootstrap
  starter/main.go      # client code (starting workflows)
internal/
  workflows/
    order.go           # workflow definitions
  activities/
    order.go           # activity implementations
```

## Worker Bootstrap

```go
package main

import (
    "log"
    "os"

    "go.temporal.io/sdk/client"
    "go.temporal.io/sdk/worker"
    "yourapp/internal/activities"
    "yourapp/internal/workflows"
)

func main() {
    address := os.Getenv("TEMPORAL_ADDRESS")
    if address == "" {
        address = "localhost:7233"
    }

    c, err := client.Dial(client.Options{
        HostPort:  address,
        Namespace: "default",
    })
    if err != nil {
        log.Fatalf("Unable to connect: %v", err)
    }
    defer c.Close()

    w := worker.New(c, "my-task-queue", worker.Options{})
    w.RegisterWorkflow(workflows.OrderWorkflow)
    w.RegisterActivity(activities.ProcessOrder)
    w.RegisterActivity(activities.SendNotification)

    if err := w.Run(worker.InterruptCh()); err != nil {
        log.Fatalf("Worker failed: %v", err)
    }
}
```

`worker.InterruptCh()` returns a channel that closes on SIGINT/SIGTERM, enabling graceful shutdown.

## Workflow Definition

```go
package workflows

import (
    "time"

    "go.temporal.io/sdk/temporal"
    "go.temporal.io/sdk/workflow"
    "yourapp/internal/activities"
)

func OrderWorkflow(ctx workflow.Context, orderID string) (string, error) {
    retryPolicy := &temporal.RetryPolicy{
        InitialInterval:    time.Second,
        BackoffCoefficient: 2.0,
        MaximumInterval:    30 * time.Second,
        MaximumAttempts:    3,
    }

    activityOptions := workflow.ActivityOptions{
        ScheduleToCloseTimeout: 5 * time.Minute,
        StartToCloseTimeout:    1 * time.Minute,
        RetryPolicy:            retryPolicy,
    }
    ctx = workflow.WithActivityOptions(ctx, activityOptions)

    var result activities.OrderResult
    if err := workflow.ExecuteActivity(ctx, activities.ProcessOrder, orderID).Get(ctx, &result); err != nil {
        return "", err
    }

    if err := workflow.ExecuteActivity(ctx, activities.SendNotification, result.CustomerID, result.Message).Get(ctx, nil); err != nil {
        return "", err
    }

    return result.OrderID, nil
}
```

## Activity Definition

```go
package activities

import (
    "context"
    "fmt"

    "go.temporal.io/sdk/activity"
    "go.temporal.io/sdk/temporal"
)

type OrderResult struct {
    OrderID    string
    CustomerID string
    Message    string
}

func ProcessOrder(ctx context.Context, orderID string) (OrderResult, error) {
    activity.RecordHeartbeat(ctx, map[string]string{"orderID": orderID, "step": "processing"})

    order, err := db.Orders.FindByID(ctx, orderID)
    if err != nil {
        return OrderResult{}, err
    }
    if order == nil {
        return OrderResult{}, temporal.NewNonRetryableApplicationError(
            fmt.Sprintf("order %s not found", orderID),
            "NotFound",
            nil,
        )
    }

    return OrderResult{
        OrderID:    orderID,
        CustomerID: order.CustomerID,
        Message:    "Order processed",
    }, nil
}
```

## Client Usage

```go
package main

import (
    "context"
    "log"

    "go.temporal.io/sdk/client"
    "yourapp/internal/workflows"
)

func main() {
    c, err := client.Dial(client.Options{HostPort: "localhost:7233"})
    if err != nil {
        log.Fatalf("Unable to connect: %v", err)
    }
    defer c.Close()

    we, err := c.ExecuteWorkflow(
        context.Background(),
        client.StartWorkflowOptions{
            ID:        "order-" + orderID,
            TaskQueue: "my-task-queue",
        },
        workflows.OrderWorkflow,
        orderID,
    )
    if err != nil {
        log.Fatalf("Unable to start workflow: %v", err)
    }

    var result string
    if err := we.Get(context.Background(), &result); err != nil {
        log.Fatalf("Workflow failed: %v", err)
    }
    log.Printf("Result: %s", result)
}
```

## Temporal Cloud Connection

```go
import (
    "crypto/tls"
    "crypto/x509"
    "os"

    "go.temporal.io/sdk/client"
)

cert, err := tls.LoadX509KeyPair("client.pem", "client.key")
if err != nil { log.Fatal(err) }

c, err := client.Dial(client.Options{
    HostPort:  "your-namespace.tmprl.cloud:7233",
    Namespace: "your-namespace.your-account",
    ConnectionOptions: client.ConnectionOptions{
        TLS: &tls.Config{
            Certificates: []tls.Certificate{cert},
        },
    },
})
```

## Context Propagation

In Go, the workflow context (`workflow.Context`) is distinct from the standard `context.Context`. Activities receive a standard `context.Context`. Never use `context.Background()` inside an activity — use the provided context so cancellation propagates correctly.

```go
func MyActivity(ctx context.Context, input string) (string, error) {
    // Use ctx for all sub-calls
    resp, err := httpClient.DoWithContext(ctx, req)
    if err != nil {
        if ctx.Err() != nil {
            return "", temporal.NewCanceledError()
        }
        return "", err
    }
    return resp.Body, nil
}
```
