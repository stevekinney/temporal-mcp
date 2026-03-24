# Temporal MCP

An MCP server that gives AI agents read-only access to your Temporal infrastructure — plus an Agent Skill that provides expert Temporal development guidance.

The server exposes 28 tools across six categories—workflows, schedules, infrastructure, workers, connections, and documentation—along with 5 resource types, 4 prompt templates, a built-in documentation search subsystem, and a policy engine that controls what agents are allowed to see. Temporal operations are read-only (no writes to Temporal state). The `docs.refresh` tool does have local side effects: it performs network `git` syncs and writes cache/index files under `~/.temporal-mcp`.

## Agent Skill

`temporal-mcp` ships a spec-compliant [Agent Skill](https://agentskills.io/specification) at `skill/SKILL.md`. The skill is a curated knowledge package — markdown reference files covering Temporal architecture, determinism rules, workflow patterns, common gotchas, versioning strategies, troubleshooting decision trees, and language-specific guidance for TypeScript, Python, and Go.

The skill and the MCP server solve complementary problems:
- The **skill** teaches agents how to *write* correct Temporal code
- The **MCP server** lets agents *observe* running infrastructure

**Install the skill standalone** (no MCP server required):

```bash
# Claude Code / Claude Desktop (skills directory)
cp -r skill/ ~/.claude/skills/temporal-mcp/
```

**Or use it via the MCP server** — the skill is included in the package. When both are active, tools like `temporal.workflow.describe` return a `guidance` field pointing to the relevant reference file when the workflow is in a notable state (failed, timed out, etc.), and `docs.search` searches both the Temporal docs corpus and the curated references.

## Features

- **28 read-only tools** for inspecting workflows, schedules, task queues, namespaces, workers, and cluster state
- **5 MCP resource types** for direct access to Temporal entities via URI templates
- **4 prompt templates** (`temporal-debug-workflow`, `temporal-triage`, `temporal-docs-answer`, `temporal-safe-mutation`) that combine live cluster data with curated guidance
- **Agent Skill** at `skill/SKILL.md` with 22 curated reference files for TypeScript, Python, and Go development
- **Documentation subsystem** that indexes and searches the Temporal docs corpus plus curated references locally
- **Multi-profile connections** to multiple Temporal clusters (self-hosted and Cloud) from one server
- **Policy engine** with four modes, glob-based tool filtering, and profile/namespace allowlists
- **Audit logging** with structured JSON to `stderr` and automatic sensitive field redaction
- **Zero Temporal write operations** by design—no starts, signals, cancels, terminates, or deletes

## Using Both Together

When the MCP server is connected to a Temporal cluster and the skill is loaded into the agent's context, the two capabilities reinforce each other:

- **`temporal.workflow.describe`** on a timed-out or failed workflow returns a `guidance` field: `"See skill/references/core/gotchas.md for common timeout causes..."`. The agent can then load that reference file to understand the failure and how to fix the code.
- **`temporal.workflow.history.summarize`** detecting workflow task failures (often non-determinism errors) returns guidance pointing to `skill/references/core/determinism.md` and `skill/references/core/versioning.md`.
- **`docs.search`** searches both the Temporal documentation corpus and the curated reference files, with curated results ranked higher (they're more information-dense).
- **`docs.get`** can retrieve curated reference files directly: `docs.get({ sourcePath: "skill/references/core/determinism.md" })`.
- **Prompt templates** (`temporal-debug-workflow`, `temporal-triage`) orchestrate multi-step diagnostic workflows that interleave MCP tool calls with curated knowledge lookups.

## Prerequisites

- [Node.js](https://nodejs.org) 20+ runtime
- A running Temporal cluster (self-hosted) or a Temporal Cloud account
- An MCP-compatible client (Claude Desktop, Claude Code, or any client that speaks `stdio` transport)

## Installation

```bash
npx -y temporal-mcp
```

For local development builds:

```bash
bun install
bun run build
node dist/cli.js
```

The server communicates over `stdio` transport by default. Your MCP client launches it as a subprocess—you don't run it in a separate terminal.

Bun is required for development and build workflows. Runtime execution uses Node.js (`dist/cli.js` or the `temporal-mcp` CLI).

## Configuration

The server looks for configuration in this order, using the first file it finds:

1. The path in the `TEMPORAL_MCP_CONFIG` environment variable
2. `.temporal-mcp.json` in the current working directory
3. `~/.config/temporal-mcp/config.json`
4. Built-in defaults (no profiles configured)

### Self-hosted profile

```json
{
  "temporal": {
    "defaultProfile": "local",
    "profiles": {
      "local": {
        "kind": "self-hosted",
        "address": "localhost:7233",
        "namespace": "default"
      }
    }
  }
}
```

### Cloud profile

```json
{
  "temporal": {
    "defaultProfile": "production",
    "profiles": {
      "production": {
        "kind": "cloud",
        "address": "my-namespace.tmprl.cloud:7233",
        "namespace": "my-namespace"
      }
    }
  }
}
```

For Cloud connections, set the `TEMPORAL_API_KEY` environment variable with your API key.

### Multiple profiles

```json
{
  "temporal": {
    "defaultProfile": "local",
    "profiles": {
      "local": {
        "kind": "self-hosted",
        "address": "localhost:7233",
        "namespace": "default"
      },
      "production": {
        "kind": "cloud",
        "address": "my-namespace.tmprl.cloud:7233",
        "namespace": "my-namespace"
      }
    }
  }
}
```

Every tool accepts an optional `profile` parameter. When omitted, the server uses `defaultProfile`. When provided, it connects to that specific profile's cluster.

## Connecting to an MCP client

### Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "temporal": {
      "command": "npx",
      "args": ["-y", "temporal-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add temporal -- npx -y temporal-mcp
```

### Other clients

Any MCP client that supports `stdio` transport can launch the server. Point it at `npx -y temporal-mcp` (or `temporal-mcp` after a global install) and the server handles the rest.

## Tools

### Workflow

| Tool                                  | Description                                                  | Stability |
| ------------------------------------- | ------------------------------------------------------------ | --------- |
| `temporal.workflow.list`              | List workflows with optional visibility query filters        | stable    |
| `temporal.workflow.describe`          | Get detailed information about a specific workflow execution | stable    |
| `temporal.workflow.count`             | Count workflows matching a visibility query filter           | stable    |
| `temporal.workflow.result`            | Get the result of a completed workflow execution             | stable    |
| `temporal.workflow.query`             | Query a running workflow using a named query handler         | stable    |
| `temporal.workflow.history`           | Get the event history of a workflow in chronological order   | stable    |
| `temporal.workflow.history.reverse`   | Get event history in reverse chronological order via gRPC    | stable    |
| `temporal.workflow.history.summarize` | Get a summarized view focusing on key events                 | stable    |

### Schedule

| Tool                               | Description                                           | Stability |
| ---------------------------------- | ----------------------------------------------------- | --------- |
| `temporal.schedule.list`           | List schedules from a Temporal cluster                | stable    |
| `temporal.schedule.describe`       | Get detailed information about a specific schedule    | stable    |
| `temporal.schedule.matching-times` | Get matching times for a schedule within a time range | stable    |

### Infrastructure

| Tool                                | Description                                                       | Stability |
| ----------------------------------- | ----------------------------------------------------------------- | --------- |
| `temporal.task-queue.describe`      | Describe a task queue including pollers and backlog status        | stable    |
| `temporal.task-queue.configuration` | Get task queue configuration including rate limits                | stable    |
| `temporal.namespace.list`           | List all namespaces (self-hosted only)                            | stable    |
| `temporal.namespace.describe`       | Get detailed information about a specific namespace               | stable    |
| `temporal.search-attributes.list`   | List search attributes configured for a namespace                 | stable    |
| `temporal.cluster.info`             | Get cluster system info including server version and capabilities | stable    |

### Worker

| Tool                                          | Description                                            | Stability    |
| --------------------------------------------- | ------------------------------------------------------ | ------------ |
| `temporal.worker.versioning-rules`            | Get worker versioning rules for a task queue           | experimental |
| `temporal.worker.task-reachability`           | Check if workers on a task queue can receive tasks     | experimental |
| `temporal.worker.deployment.list`             | List worker deployments in a namespace                 | experimental |
| `temporal.worker.deployment.describe`         | Describe a specific worker deployment and its versions | experimental |
| `temporal.worker.deployment.version.describe` | Describe a specific version of a worker deployment     | experimental |
| `temporal.worker.deployment.reachability`     | Check if a worker deployment can still receive tasks   | experimental |

### Connection

| Tool                        | Description                              | Stability |
| --------------------------- | ---------------------------------------- | --------- |
| `temporal.connection.check` | Check connectivity to a Temporal cluster | stable    |

### Documentation

| Tool           | Description                                                                  | Stability |
| -------------- | ---------------------------------------------------------------------------- | --------- |
| `docs.status`  | Check the status of the local documentation corpus and curated references    | stable    |
| `docs.search`  | Search the Temporal docs corpus and curated skill references                 | stable    |
| `docs.get`     | Get a documentation page or curated reference (`skill/references/core/...`) | stable    |
| `docs.refresh` | Refresh the local docs corpus and re-index curated references                | stable    |

`docs.search` boosts curated reference results 1.5× over raw docs corpus results. `docs.get` accepts paths in the form `skill/references/{category}/{file}.md` to retrieve curated reference files directly.

## Prompts

Four prompt templates are registered and discoverable by any MCP client that supports the prompts capability:

| Prompt                      | Arguments                                   | Purpose                                                                                    |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `temporal-debug-workflow`   | `workflowId`, `namespace?`, `profile?`      | Step-by-step workflow diagnosis combining live state, event history, and reference lookups |
| `temporal-triage`           | `namespace`, `taskQueue?`, `profile?`       | Namespace health check: recent failures, worker connectivity, and task queue backlogs      |
| `temporal-docs-answer`      | `question`, `sdk?`                          | Answer a Temporal question using the docs corpus and curated references                    |
| `temporal-safe-mutation`    | `workflowId`, `signalName`, `namespace?`, `profile?` | Pre-flight state checks before sending a signal to a running workflow               |

Each prompt instructs the agent to call the relevant MCP tools, load the appropriate curated reference files, and produce a structured output. They're designed to be used directly from any MCP client prompt picker.

## Resources

| Resource      | URI Template                                   | Format             |
| ------------- | ---------------------------------------------- | ------------------ |
| Workflow      | `temporal:///{profile}/workflow/{workflowId}`  | `application/json` |
| Schedule      | `temporal:///{profile}/schedule/{scheduleId}`  | `application/json` |
| Task Queue    | `temporal:///{profile}/task-queue/{taskQueue}` | `application/json` |
| Namespace     | `temporal:///{profile}/namespace/{namespace}`  | `application/json` |
| Documentation | `docs:///chunk/{sourcePath}`                   | `text/markdown`    |

## Policy engine

The policy engine controls which tools an agent can invoke. It defaults to `readOnly`, which allows all 28 tools since they are all read-only by design.

### Modes

| Mode        | Behavior                                                                               |
| ----------- | -------------------------------------------------------------------------------------- |
| `readOnly`  | Allows all read-risk tools. This is the default.                                       |
| `safeWrite` | Allows read-risk tools and write-risk tools marked as safe (none exist yet).           |
| `custom`    | Applies no additional risk-based restriction beyond the global filters and allowlists. |
| `unsafe`    | Allows everything, but requires the break-glass environment variable to be set.        |

### Tool filtering

In any mode, `allowPatterns` and `denyPatterns` can control which tools are available:

```json
{
  "policy": {
    "mode": "custom",
    "allowPatterns": ["temporal.workflow.*", "temporal.schedule.*"],
    "denyPatterns": ["temporal.worker.**"]
  }
}
```

Deny patterns take precedence over allow patterns.

### Profile and namespace allowlists

Restrict which profiles and namespaces agents can access. An empty list means "allow all":

```json
{
  "policy": {
    "allowedProfiles": ["local", "staging"],
    "allowedNamespaces": ["default", "my-app"]
  }
}
```

### Hard read-only lock

Setting `hardReadOnly` to `true` overrides every other policy setting and locks the server to read-only tools, regardless of the configured mode:

```json
{
  "policy": {
    "hardReadOnly": true
  }
}
```

### Break-glass override

The `unsafe` mode requires the `TEMPORAL_MCP_BREAK_GLASS` environment variable to be set. Without it, unsafe tool calls are denied with `BREAK_GLASS_REQUIRED`. This exists as a deliberate speed bump—you have to opt in twice.

## Safety

### Audit logging

Every tool invocation is logged as structured JSON to `stderr`, including the tool name, parameters, policy decision, result status, and duration. Each request gets a unique tracking ID.

### Sensitive field redaction

Tool responses and JSON resource responses are automatically scanned for sensitive fields. Any key matching one of these patterns (case-insensitive) has its value replaced with `[REDACTED]`:

`apiKey`, `password`, `token`, `secret`, `credential`, `authorization`, `cookie`, `session`

### What this server does not do

This server is intentionally limited to observation. It does not:

- Start, signal, cancel, or terminate workflows
- Create, pause, unpause, or delete schedules
- Create or modify namespaces
- Modify task queue configuration
- Perform any cluster administration
- Write to any Temporal state

## Project structure

```
src/
  index.ts                  # Entry point
skill/
  SKILL.md                  # Agent Skills spec entry point
  references/
    core/                   # Language-agnostic reference files (determinism, patterns, etc.)
    typescript/             # TypeScript SDK reference files
    python/                 # Python SDK reference files
    go/                     # Go SDK reference files
packages/
  server/                   # MCP server, config, policy, tools, resources, safety
    src/
      guidance/             # Guidance annotation patterns and post-processing
      prompts/              # MCP prompt template registration
  temporal/                 # Temporal client, gRPC calls, capability matrix
  docs/                     # Documentation indexing and search (corpus + curated refs)
```

## Maintainer release workflow

### One-time bootstrap publish

1. Authenticate to npm from a maintainer machine (`npm login`).
2. Build and validate:

```bash
bun install --frozen-lockfile
bun run check
bun run build
npm pack --dry-run
```

3. Publish the initial package:

```bash
npm publish --access public
```

4. In npm package settings, add trusted publishing for this repository and `.github/workflows/release.yml`.
   Provenance is generated automatically in the tag-driven CI release workflow once OIDC trusted publishing is configured.

### Ongoing releases (tag-driven)

1. Bump the package version and create a `vX.Y.Z` tag:

```bash
bun run release:patch
# or: bun run release:minor
# or: bun run release:major
```

2. Pushing the tag triggers `.github/workflows/release.yml`, which:
   - installs dependencies with Bun
   - runs `bun run check` and `bun run build`
   - publishes to npm using OIDC trusted publishing (no `NPM_TOKEN` secret)

## Development

```bash
bun install
bun run check
# optional coverage report
bun run test:coverage
```

For pull request validation expectations and CI parity details, see [CONTRIBUTING.md](./CONTRIBUTING.md).
