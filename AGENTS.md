---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Path Containment Safety

- When containment checks are based on `path.relative`, treat absolute outputs (including Windows drive-letter forms) as outside the root boundary.
- Normalize path separators before prefix checks so containment logic remains separator-agnostic across platforms.

## Review Memory Invariants

- Resolve policy scope first, then use the resolved profile/namespace consistently for policy evaluation, audit context, and client acquisition.
- Evaluate Temporal policy against resolved profile/namespace values, not raw optional inputs.
- Enforce policy documentation and behavior that `allowPatterns` and `denyPatterns` run before mode checks in every mode.
- Treat policy allowlist misses as a distinct decision code from deny-pattern matches.
- Keep capability-matrix contract lookup fail-closed (`TOOL_NOT_FOUND`) and centralized in shared helpers such as `requireToolContract`.
- Never skip policy evaluation when a tool/resource contract lookup fails.
- Resources must enforce the same policy and redaction guarantees as equivalent tools.
- Resource resolvers must emit audit `tool_call`, `policy_decision`, and `tool_result` events with request context.
- Build request context exactly once per handler, then mutate `requestContext.profile` after scope resolution.
- Emit exactly one `tool_call` before any `tool_result`; if early scope resolution can throw, add catch-path fallback `tool_call` logging.
- Emit `tool_result` logs on all early-error returns so failed paths remain observable.
- Reuse the original request context through helper-based policy checks to preserve request IDs.
- Keep audit argument-redaction and response-redaction pattern sets aligned.
- For unsafe/break-glass gating, check environment-variable presence (`=== undefined`) rather than truthiness.
- Documentation path validation must include realpath boundary checks to block symlink escapes.
- Keep path-containment logic separator-agnostic and avoid redundant/dead traversal guards once normalized boundary checks exist.
- Status endpoints that summarize index data must rely on metadata persisted at index-build time.
- Any refresh flow that claims search readiness must rebuild and persist the index in the same operation.
- Recovery after failed repository sync/subprocess steps must validate exit codes and return structured errors.
- Decode subprocess `Uint8Array` output explicitly with `TextDecoder` before parsing stderr/stdout-derived metadata.
- SSRF guards for codec endpoints must normalize IPv6 hostnames and treat IPv6-mapped IPv4 addresses as the underlying IPv4 for private-range checks.
- Codec decode paths must treat any defined payload (including falsy values) as valid; only `undefined` is an empty result.
- Legacy registration entrypoints must delegate to the shared `ToolRegistrationContext` pipeline to preserve policy/audit/redaction behavior.
- Package export maps must reference real entrypoint files; maintain the `src/index.ts` barrel when exporting `"."`.
- Legacy registration tests should verify stable workflow-level behavior and mock policy-scope connection methods used by shared registration.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
