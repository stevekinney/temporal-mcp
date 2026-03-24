import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';

function promptArgs<T extends Record<string, unknown>>(
	shape: T,
): ZodRawShapeCompat {
	return shape as unknown as ZodRawShapeCompat;
}

export function registerAllPrompts(server: McpServer): void {
	server.registerPrompt(
		'temporal-debug-workflow',
		{
			description:
				'Debug a stuck or failing Temporal workflow. Retrieves live cluster state and provides structured diagnostic guidance.',
			argsSchema: promptArgs({
				workflowId: z.string().describe('The workflow ID to debug'),
				namespace: z
					.string()
					.optional()
					.describe('Temporal namespace (defaults to profile default)'),
				profile: z
					.string()
					.optional()
					.describe('Connection profile name'),
			}),
		},
		({ workflowId, namespace, profile }: Record<string, string>) => {
			const ns = namespace ?? 'default';
			const profileClause = profile ? ` with profile "${profile}"` : '';
			return {
				messages: [
					{
						role: 'user' as const,
						content: {
							type: 'text' as const,
							text: `Debug the Temporal workflow "${workflowId}" in namespace "${ns}"${profileClause}.

Follow these steps in order:

## Step 1: Get current workflow state
Call \`temporal.workflow.describe\` with workflowId="${workflowId}"${namespace ? ` and namespace="${namespace}"` : ''}${profile ? ` and profile="${profile}"` : ''}.

Examine the result for:
- \`status\`: Is it RUNNING, FAILED, TIMED_OUT, CANCELED, or TERMINATED?
- \`pendingActivities\`: Are there activities stuck waiting?
- \`pendingChildWorkflows\`: Are there child workflows blocked?

## Step 2: Get summarized event history
Call \`temporal.workflow.history.summarize\` with the same arguments.

Look at:
- \`eventTypeCounts\`: High counts of EVENT_TYPE_WORKFLOW_TASK_FAILED suggest non-determinism issues
- \`milestones\`: The sequence of key events reveals where execution stalled

## Step 3: Consult the diagnostic reference
Based on the status from Step 1:

- **FAILED** → Read \`skill/references/core/error-reference.md\` and \`skill/references/core/troubleshooting.md\`
- **TIMED_OUT** → Read \`skill/references/core/gotchas.md\` (timeout section)
- **Workflow task failures** in event counts → Read \`skill/references/core/determinism.md\` and get full history with \`temporal.workflow.history\`
- **Stuck RUNNING with pending activities** → Call \`temporal.task-queue.describe\` to check for pollers

## Step 4: If non-determinism is suspected
Get the full event history: call \`temporal.workflow.history\` with the same arguments.
Look for EVENT_TYPE_WORKFLOW_TASK_FAILED events. The attributes will contain the cause.
Then read \`skill/references/core/versioning.md\` for migration options.

## Step 5: Produce a structured diagnosis
Output:
- **Root cause**: What went wrong
- **Evidence**: Specific fields from the workflow state that support the diagnosis
- **Recommended fix**: Concrete next steps (code change, configuration change, or operational action)`,
						},
					},
				],
			};
		},
	);

	server.registerPrompt(
		'temporal-triage',
		{
			description:
				'Triage the health of a Temporal namespace: check workers, recent failures, and task queue backlogs.',
			argsSchema: promptArgs({
				namespace: z.string().describe('The namespace to triage'),
				taskQueue: z
					.string()
					.optional()
					.describe('Specific task queue to inspect (optional)'),
				profile: z
					.string()
					.optional()
					.describe('Connection profile name'),
			}),
		},
		({ namespace, taskQueue, profile }: Record<string, string>) => {
			const profileClause = profile ? ` with profile "${profile}"` : '';
			const taskQueueClause = taskQueue
				? ` focusing on task queue "${taskQueue}"`
				: '';
			return {
				messages: [
					{
						role: 'user' as const,
						content: {
							type: 'text' as const,
							text: `Triage the health of Temporal namespace "${namespace}"${taskQueueClause}${profileClause}.

Follow these steps:

## Step 1: Namespace health
Call \`temporal.namespace.describe\` with namespace="${namespace}"${profile ? ` and profile="${profile}"` : ''}.
Check: Is the namespace active? What are the retention settings?

## Step 2: Check for recent failures
Call \`temporal.workflow.list\` with a query filter to find unhealthy workflows:
- Query: \`ExecutionStatus = "Failed" OR ExecutionStatus = "TimedOut"\`
- Limit to the last 10 results.

## Step 3: Task queue health
${
	taskQueue
		? `Call \`temporal.task-queue.describe\` for task queue "${taskQueue}" in namespace "${namespace}".`
		: `Call \`temporal.task-queue.describe\` for any task queue names visible in the failed workflow results from Step 2.`
}
Check:
- \`pollers\`: Zero pollers means no workers are consuming work
- Backlog count: High backlog with active pollers indicates worker throughput issues

## Step 4: Consult the troubleshooting reference
Read \`skill/references/core/troubleshooting.md\` for decision trees matching any issues found.
Read \`skill/references/core/operational-patterns.md\` for task queue health indicators.

## Step 5: Produce a triage summary
Output:
- **Namespace status**: Active/degraded, key settings
- **Recent failures**: Count, types, and patterns
- **Worker health**: Pollers present, backlog size
- **Recommended actions**: Ordered by priority`,
						},
					},
				],
			};
		},
	);

	server.registerPrompt(
		'temporal-docs-answer',
		{
			description:
				'Answer a question about Temporal using the docs corpus and curated reference files.',
			argsSchema: promptArgs({
				question: z.string().describe('The question to answer'),
				sdk: z
					.enum(['typescript', 'python', 'go', 'java', 'dotnet'])
					.optional()
					.describe('Filter results to a specific SDK'),
			}),
		},
		({ question, sdk }: Record<string, string>) => {
			const sdkClause = sdk ? ` filtered to the ${sdk} SDK` : '';
			return {
				messages: [
					{
						role: 'user' as const,
						content: {
							type: 'text' as const,
							text: `Answer this Temporal question: "${question}"

Follow these steps:

## Step 1: Search the docs corpus
Call \`docs.search\` with query="${question}"${sdk ? ` and sdk="${sdk}"` : ''}.
This searches both the Temporal documentation corpus and curated reference files${sdkClause}.

## Step 2: Retrieve relevant pages
For the top 3 results from Step 1, call \`docs.get\` with each result's \`sourcePath\`.
Curated references (paths starting with \`skill/\`) are higher-signal — read those first.

## Step 3: Check language-specific references if applicable
${
	sdk
		? `Since this is a ${sdk} question, also read \`skill/references/${sdk}/${sdk}.md\` for SDK-specific context.`
		: `If the question is language-specific, read the appropriate \`skill/references/{language}/{language}.md\` file.`
}

## Step 4: Produce a grounded answer
- Cite the specific docs pages or reference files you drew from
- Include a minimal code example if the question is about implementation
- Note any important caveats or gotchas from the curated references`,
						},
					},
				],
			};
		},
	);

	server.registerPrompt(
		'temporal-safe-mutation',
		{
			description:
				'Safely send a signal or update to a running Temporal workflow, with pre-flight state checks.',
			argsSchema: promptArgs({
				workflowId: z.string().describe('The workflow ID to signal'),
				signalName: z
					.string()
					.describe('The name of the signal or update handler to call'),
				namespace: z
					.string()
					.optional()
					.describe('Temporal namespace'),
				profile: z
					.string()
					.optional()
					.describe('Connection profile name'),
			}),
		},
		({ workflowId, signalName, namespace, profile }: Record<string, string>) => {
			const ns = namespace ?? 'default';
			const profileClause = profile ? ` with profile "${profile}"` : '';
			return {
				messages: [
					{
						role: 'user' as const,
						content: {
							type: 'text' as const,
							text: `Safely send signal "${signalName}" to workflow "${workflowId}" in namespace "${ns}"${profileClause}.

## Pre-flight check (required before any mutation)

### Step 1: Verify workflow is RUNNING
Call \`temporal.workflow.describe\` with workflowId="${workflowId}"${namespace ? ` and namespace="${namespace}"` : ''}${profile ? ` and profile="${profile}"` : ''}.

**Stop here** if status is not WORKFLOW_EXECUTION_STATUS_RUNNING. Sending a signal to a non-running workflow is usually a no-op or an error.

### Step 2: Check the signal handler exists
Read \`skill/references/core/patterns.md\` (signals section) to understand what a correctly implemented signal handler looks like.
If you have access to the workflow source code, verify that a handler named "${signalName}" is registered.

### Step 3: Review signal semantics
Signals are fire-and-forget — they are queued and processed asynchronously.
Verify with the workflow author that "${signalName}" is safe to send now given the workflow's current state (from Step 1).

## Mutation

### Step 4: Send the signal
Use \`temporal.workflow.signal\` (if available in your policy mode) with:
- workflowId: "${workflowId}"
- signalName: "${signalName}"
${namespace ? `- namespace: "${namespace}"` : ''}
${profile ? `- profile: "${profile}"` : ''}

### Step 5: Confirm delivery
Call \`temporal.workflow.describe\` again after a few seconds.
Check that the workflow state has advanced as expected (e.g., pending activities changed, workflow completed).`,
						},
					},
				],
			};
		},
	);
}
