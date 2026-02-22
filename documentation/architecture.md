# Architecture

This document defines the package-level architecture for Temporal MCP.

## Package boundaries

- `packages/server`: MCP lifecycle, transport, registration, policy orchestration, observability.
- `packages/temporal`: Temporal connectivity and operation adapters (SDK-first, raw gRPC/cloud fallback).
- `packages/docs`: Documentation sync/index/search/retrieval.

## Runtime flow

1. Host initializes MCP session.
2. Server negotiates capabilities.
3. Tool/resource/prompt request enters server dispatcher.
4. Policy + profile routing is applied.
5. Temporal/docs subsystem performs operation.
6. Response is normalized to structured envelope.
7. Audit/progress/log notifications are emitted.

## Contract authority

Contract files under `packages/server/src/contracts/**` are the source of truth.
Contract changes require version bumps and explicit migration notes.
