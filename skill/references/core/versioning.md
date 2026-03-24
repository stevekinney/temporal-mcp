# Workflow Versioning

---

## The Versioning Problem

When you deploy new worker code, Temporal does not automatically migrate running workflows to use the new logic. Running workflows continue replaying their recorded event history — and that history was written by your old code. If your new code issues a different sequence of commands for the same history (added activity, renamed activity, changed timer duration, removed a step), Temporal detects a mismatch during replay and throws a non-determinism error.

You have three strategies to evolve workflow code safely. The right choice depends on how many old workflows are still running and how different the new code is.

---

## Strategy 1: Patch / GetVersion

Add explicit version branches using SDK-provided primitives. The SDK records a marker in history the first time a patched code path executes. On replay, if the marker is present, the new branch runs. If the marker is absent (old history), the old branch runs.

This strategy keeps one workflow type and gradually migrates all instances to the new behavior over three phases.

### TypeScript: `patched()` / `deprecatePatch()`

**Phase 1 — Add the patch** (deploy while old workflows are still running):

```typescript
import { patched } from '@temporalio/workflow';

export async function myWorkflow(): Promise<void> {
  if (patched('add-new-step-v1')) {
    // New behavior: includes the new activity
    await executeActivity(newActivity, opts);
    await executeActivity(finalizeActivity, opts);
  } else {
    // Old behavior: old workflows without the marker run this path
    await executeActivity(finalizeActivity, opts);
  }
}
```

**Phase 2 — Deprecate the patch** (deploy after all workflows using the old path have completed):

```typescript
import { deprecatePatch } from '@temporalio/workflow';

export async function myWorkflow(): Promise<void> {
  deprecatePatch('add-new-step-v1'); // records marker, no more branching
  await executeActivity(newActivity, opts);
  await executeActivity(finalizeActivity, opts);
}
```

**Phase 3 — Remove the patch** (deploy after all workflows with `deprecatePatch` markers have completed):

```typescript
export async function myWorkflow(): Promise<void> {
  // No patch code at all — clean implementation
  await executeActivity(newActivity, opts);
  await executeActivity(finalizeActivity, opts);
}
```

### Python: `workflow.patched()` / `workflow.deprecate_patch()`

**Phase 1:**

```python
from temporalio import workflow

@workflow.defn
class MyWorkflow:
    @workflow.run
    async def run(self) -> None:
        if workflow.patched("add-new-step-v1"):
            await workflow.execute_activity(new_activity, schedule_to_close_timeout=timedelta(seconds=30))
        await workflow.execute_activity(finalize_activity, schedule_to_close_timeout=timedelta(seconds=30))
```

**Phase 2:**

```python
@workflow.defn
class MyWorkflow:
    @workflow.run
    async def run(self) -> None:
        workflow.deprecate_patch("add-new-step-v1")
        await workflow.execute_activity(new_activity, schedule_to_close_timeout=timedelta(seconds=30))
        await workflow.execute_activity(finalize_activity, schedule_to_close_timeout=timedelta(seconds=30))
```

**Phase 3:** Remove all patch code.

### Go: `workflow.GetVersion()`

Go uses `GetVersion` which takes a min and max version number:

```go
// Phase 1 — original code had no version gate
const workflowVersion = workflow.DefaultVersion // = -1

v := workflow.GetVersion(ctx, "add-new-step-v1", workflow.DefaultVersion, 1)
if v == 1 {
    // New path
    workflow.ExecuteActivity(ctx, NewActivity).Get(ctx, nil)
}
workflow.ExecuteActivity(ctx, FinalizeActivity).Get(ctx, nil)
```

```go
// Phase 2 — old code path no longer supported (raise minimum version to 1)
v := workflow.GetVersion(ctx, "add-new-step-v1", 1, 1)
// v is always 1 for new workflows; old workflows without marker fail (they should be drained)
workflow.ExecuteActivity(ctx, NewActivity).Get(ctx, nil)
workflow.ExecuteActivity(ctx, FinalizeActivity).Get(ctx, nil)
```

**Phase 3:** Remove `GetVersion` entirely after all old executions complete.

---

## Strategy 2: New Workflow Type Name

Deploy the new behavior as a completely separate workflow type (different function name / class name). Route new workflow starts to the new type. Let old instances drain to completion on the old code.

This is the safest approach for large-scale changes and requires no patch code.

```typescript
// Old — keep running for in-flight workflows
export async function processOrderWorkflow(order: Order): Promise<void> { ... }

// New — route new orders here
export async function processOrderWorkflowV2(order: Order): Promise<void> { ... }
```

**When to use this strategy**:
- The change is so extensive that patching every difference would be impractical.
- You can control which workflow type gets started at the client call site.
- You are comfortable running two sets of workers temporarily.

---

## Strategy 3: Worker Versioning with Build IDs

Worker versioning is a newer Temporal feature that pins in-flight workflow executions to the build ID of the worker that started them. New workers with a new build ID handle new executions; old workers with the old build ID continue to drain old executions.

**Assigning a build ID to a worker**:

```typescript
const worker = await Worker.create({
  taskQueue: 'order-processing',
  buildId: '2024-11-01-v2',
  useVersioning: true,
  // ... other options
});
```

**Promoting a build ID to default** (new executions will be routed here):

```sh
temporal task-queue update-build-ids promote-id-to-current \
  --task-queue order-processing \
  --build-id 2024-11-01-v2
```

**When to use this strategy**:
- You want Temporal to manage routing automatically without code changes.
- You can assign meaningful build IDs to each deployment (git SHA, version tag).
- You are on a recent enough Temporal server version (check the changelog).

**Tradeoffs vs patching**:
- Build IDs: Simpler code (no patch guards), but requires server and SDK version support.
- Patching: Works with any server version, explicit in the code, but accumulates technical debt during migration phases.

---

## When You Cannot Avoid Breaking Changes

If you need to make a change that cannot be patched (e.g., complete rewrite of workflow logic, change in fundamental data structures), the cleanest path is:

1. Deploy new workflow type under a new name.
2. Stop routing new starts to the old workflow type.
3. Wait for all old instances to complete (or terminate them if acceptable).
4. Remove the old workflow type and its workers.

---

## Migration Checklist

1. **Identify what changed**: activity additions, removals, renames, reordering, timer changes.
2. **Choose a strategy**: patch (incremental), new type (full rewrite), or build IDs (infrastructure-managed).
3. **For patching**:
   - Wrap every change in a `patched()` / `GetVersion` guard before deploying.
   - Deploy Phase 1 and verify old + new workflows both complete correctly.
   - Monitor until all workflows that ran the old path complete.
   - Deploy Phase 2 (`deprecatePatch`).
   - Monitor until all workflows that used `deprecatePatch` complete.
   - Deploy Phase 3 (remove all patch code).
4. **Never remove a patch in Phase 1** — old workflows in history have no marker and will run the else branch. Removing the else branch breaks them.
5. **Never skip Phase 2** (deprecation) — skipping from Phase 1 to Phase 3 will break workflows whose history contains the Phase 1 marker but not the Phase 2 marker.
6. **Test replay**: Use `temporal workflow show --workflow-id <id>` plus the Replayer tool to verify that your new code replays old histories without error before deploying.
