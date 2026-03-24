# Temporal Schedules

Schedules run workflows on a recurring basis. They replace the older pattern of using cron-scheduled workflow executions and provide richer configuration: multiple specs, overlap policies, pause/unpause, and backfill.

---

## When to Use Schedules vs Long-Running Workflows

| Use Case | Approach |
|----------|----------|
| Run a batch job every hour | Schedule |
| Run a workflow at 9 AM on weekdays | Schedule |
| Wait for an event, then do something after a delay | Long-running workflow with `workflow.sleep()` |
| Poll an API every 5 minutes until a condition is met | Long-running workflow with a loop and `workflow.sleep()` |
| Run the same workflow on multiple independent cadences | One schedule per cadence |

Schedules are managed by the Temporal server, not by your worker code. You create and configure them via the SDK client, the CLI, or the Web UI.

---

## Creating a Schedule

### TypeScript

```typescript
import { Client } from '@temporalio/client';

const client = new Client();
const handle = await client.schedule.create('daily-report', {
  spec: {
    cronExpressions: ['0 9 * * MON-FRI'],
  },
  action: {
    type: 'startWorkflow',
    workflowType: 'generateDailyReport',
    taskQueue: 'reporting',
    args: [{ reportType: 'summary' }],
  },
});
```

### Python

```python
from temporalio.client import Client, Schedule, ScheduleActionStartWorkflow, ScheduleSpec

client = await Client.connect("localhost:7233")
handle = await client.create_schedule(
    "daily-report",
    Schedule(
        action=ScheduleActionStartWorkflow(
            "GenerateDailyReport",
            arg={"report_type": "summary"},
            id="daily-report",
            task_queue="reporting",
        ),
        spec=ScheduleSpec(
            cron_expressions=["0 9 * * MON-FRI"],
        ),
    ),
)
```

### Go

```go
client, err := client.Dial(client.Options{})
handle, err := client.ScheduleClient().Create(ctx, client.ScheduleOptions{
    ID: "daily-report",
    Spec: client.ScheduleSpec{
        CronExpressions: []string{"0 9 * * MON-FRI"},
    },
    Action: &client.ScheduleWorkflowAction{
        Workflow:  GenerateDailyReport,
        TaskQueue: "reporting",
        Args:      []interface{}{ReportArgs{ReportType: "summary"}},
    },
})
```

---

## Schedule Specs

Schedules support three specification types. You can combine multiple specs on a single schedule.

### Cron Expressions

Standard 5-field cron syntax. The schedule fires at each matching time.

```
"0 * * * *"        // every hour at :00
"0 9 * * MON-FRI"  // weekdays at 9 AM
"*/15 * * * *"     // every 15 minutes
```

### Intervals

Fixed-duration intervals between schedule actions.

```typescript
spec: {
  intervals: [{ every: '2h', offset: '10m' }], // every 2 hours, offset by 10 minutes
}
```

```python
spec=ScheduleSpec(
    intervals=[ScheduleIntervalSpec(every=timedelta(hours=2), offset=timedelta(minutes=10))],
)
```

### Calendar-Based Specs

More expressive than cron. Allows specifying ranges and lists for each field.

```typescript
spec: {
  calendars: [{
    hour: [{ start: 9, end: 17 }],  // 9 AM to 5 PM
    dayOfWeek: [{ start: 'MONDAY', end: 'FRIDAY' }],
    minute: [{ start: 0 }],  // at :00
  }],
}
```

---

## Overlap Policies

Controls what happens when a schedule fires but the previous workflow is still running.

| Policy | Behavior | Use When |
|--------|----------|----------|
| `SKIP` | Skip this scheduled run entirely | Default. Batch jobs where running two simultaneously would conflict |
| `BUFFER_ONE` | Queue one run; discard additional triggers while buffered | You need at most one catch-up run after the previous finishes |
| `BUFFER_ALL` | Queue all triggered runs | Every trigger must eventually execute (use with caution — can accumulate unbounded queue) |
| `CANCEL_OTHER` | Cancel the running workflow, then start a new one | The latest data always wins and old runs are disposable |
| `TERMINATE_OTHER` | Terminate the running workflow, then start a new one | Like `CANCEL_OTHER` but without waiting for cleanup |
| `ALLOW_ALL` | Start a new run regardless of existing runs | Independent runs that do not conflict |

The most common mistake: using `ALLOW_ALL` for a job that writes to the same database rows. This causes data races.

---

## Pause, Unpause, and Trigger

```typescript
// Pause — no new runs will be triggered
await handle.pause('Pausing for maintenance');

// Unpause
await handle.unpause('Maintenance complete');

// Trigger — run immediately outside the normal schedule
await handle.trigger();
```

```python
await handle.pause("Pausing for maintenance")
await handle.unpause("Maintenance complete")
await handle.trigger()
```

---

## Backfill

Backfill runs the schedule for a past time range as if it had been active during that period. Useful after a schedule was paused, or when you create a schedule and need historical runs.

```typescript
await handle.backfill([
  {
    start: new Date('2024-01-01T00:00:00Z'),
    end: new Date('2024-01-07T00:00:00Z'),
    overlap: 'BUFFER_ALL',
  },
]);
```

```python
await handle.backfill(
    ScheduleBackfill(
        start_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        end_at=datetime(2024, 1, 7, tzinfo=timezone.utc),
        overlap=ScheduleOverlapPolicy.BUFFER_ALL,
    ),
)
```

---

## Common Gotchas

### Timezone Handling

Cron expressions run in UTC by default. To use a local timezone:

```typescript
spec: {
  cronExpressions: ['0 9 * * MON-FRI'],
  timezone: 'America/New_York',  // 9 AM Eastern, adjusts for DST
}
```

Without `timezone`, `0 9 * * *` fires at 9 AM UTC year-round. If your business logic depends on local time, always set the timezone explicitly.

### Catchup Window

When a schedule is paused and later unpaused, Temporal checks how many runs were missed. The `catchupWindow` controls how far back to look:

- If a missed run falls within the catchup window, it fires immediately on unpause.
- If a missed run is older than the catchup window, it is skipped permanently.

The default catchup window is typically 1 minute, meaning most missed runs are skipped. Set a longer catchup window if you need those runs to execute.

### Schedule ID Uniqueness

Schedule IDs are unique within a namespace. Creating a schedule with an existing ID fails. Use `update` to modify an existing schedule.

### Workflow ID Prefix

By default, workflows started by a schedule get IDs like `{scheduleId}-{timestamp}`. If you set a custom workflow ID in the action, every trigger uses that same ID — which means the `WorkflowIdReusePolicy` determines whether triggers succeed or fail when a previous run has not completed.

---

## Inspecting Schedules with MCP Tools

- `temporal.schedule.list` — list all schedules in the namespace
- `temporal.schedule.describe` — get spec, overlap policy, recent actions, next fire times, and missed catchup count
- `temporal.schedule.matching-times` — preview when a schedule will fire within a date range (useful for verifying cron expressions before deploying)

See `references/core/operational-patterns.md` for interpreting schedule describe output.
