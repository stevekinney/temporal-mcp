# Architecture

This document defines the package-level architecture for Temporal MCP.

## Package boundaries

- `packages/server`: MCP lifecycle, transport, registration, policy orchestration, observability.
- `packages/temporal`: Temporal connectivity and operation adapters (SDK-first, raw gRPC/cloud fallback).
- `packages/docs`: Documentation sync/index/search/retrieval (Temporal docs corpus + curated skill references).
- `skill/`: Agent Skill — curated knowledge package (markdown reference files). Standalone; no runtime dependency on the server packages.

## Runtime flow

1. Host initializes MCP session.
2. Server negotiates capabilities (tools, prompts, logging, resources).
3. Tool/resource/prompt request enters server dispatcher.
4. Policy + profile routing is applied.
5. Temporal/docs subsystem performs operation.
6. Response is normalized to structured envelope.
7. Guidance annotations are applied to the response where applicable (see below).
8. Audit/progress/log notifications are emitted.

## Guidance annotations

`packages/server/src/guidance/` contains a lookup table (`patterns.ts`) mapping tool name + response conditions to curated reference paths. After a tool response is produced and redacted, `annotateWithGuidance()` checks the response against the table and optionally adds a `guidance` field pointing to the relevant `skill/references/` file.

Currently annotated tools:
- `temporal.workflow.describe` — annotates on TIMED_OUT, FAILED, CANCELED, TERMINATED status
- `temporal.workflow.history.summarize` — annotates when `EVENT_TYPE_WORKFLOW_TASK_FAILED` events are present

Annotations are additive and strictly optional; the server operates normally if the skill directory is absent.

## Prompt templates

`packages/server/src/prompts/` registers four MCP prompts with the server's prompts capability. Each prompt returns a user message that instructs the agent to call specific MCP tools in sequence and consult relevant skill reference files. Prompts are stateless text templates — they do not execute tool calls themselves.

## Docs subsystem

`packages/docs/` indexes two sources during `docs.refresh`:
1. The Temporal documentation corpus (git-synced from `temporalio/documentation`)
2. Curated reference files from `skill/references/` (if present)

Curated results receive a 1.5× score boost in `docs.search`. `docs.get` routes paths starting with `skill/references/` to the skill directory with the same path-traversal protections applied to corpus paths. `docs.status` reports curated reference presence and count alongside the corpus status.

## Contract authority

Contract files under `packages/server/src/contracts/**` are the source of truth.
Contract changes require version bumps and explicit migration notes.
