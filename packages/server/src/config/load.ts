import { z } from 'zod/v4';
import { DEFAULT_APP_CONFIG } from './schema.ts';
import type { AppConfigContract } from '../contracts/config.ts';
import { homedir } from 'node:os';
import { join } from 'node:path';

const profileConfigSchema = z.object({
	kind: z.enum(['self-hosted', 'cloud']),
	address: z.string(),
	namespace: z.string(),
});

const appConfigSchema = z.object({
	mcp: z
		.object({
			capabilities: z
				.object({
					tasks: z.boolean(),
					elicitation: z.boolean(),
					roots: z.boolean(),
					completions: z.boolean(),
				})
				.partial()
				.optional(),
		})
		.optional(),
	transport: z
		.object({
			mode: z.enum(['stdio', 'http']).optional(),
			stdio: z.object({ enabled: z.boolean() }).partial().optional(),
			http: z
				.object({
					enabled: z.boolean(),
					bind: z.string(),
					authStrategy: z.enum(['oauth', 'internal']),
					internalMode: z.enum(['localhost', 'private-network']).optional(),
				})
				.partial()
				.optional(),
		})
		.optional(),
	temporal: z
		.object({
			defaultProfile: z.string().optional(),
			profiles: z.record(z.string(), profileConfigSchema).optional(),
		})
		.optional(),
	security: z
		.object({
			confirmTokenTtlSec: z.number(),
			maxTaskTtlSec: z.number(),
			codecAllowlist: z.array(z.string()),
			idempotencyWindowSec: z.number(),
		})
		.partial()
		.optional(),
	policy: z
		.object({
			mode: z.enum(['readOnly', 'safeWrite', 'custom', 'unsafe']),
			hardReadOnly: z.boolean(),
			allowedProfiles: z.array(z.string()),
			allowedNamespaces: z.array(z.string()),
			allowPatterns: z.array(z.string()),
			denyPatterns: z.array(z.string()),
			breakGlassVariable: z.string(),
		})
		.partial()
		.optional(),
});

type PartialAppConfig = z.infer<typeof appConfigSchema>;

function deepMerge(
	base: AppConfigContract,
	override: PartialAppConfig,
): AppConfigContract {
	return {
		mcp: {
			capabilities: {
				...base.mcp.capabilities,
				...override.mcp?.capabilities,
			},
		},
		transport: {
			mode: override.transport?.mode ?? base.transport.mode,
			stdio: {
				...base.transport.stdio,
				...override.transport?.stdio,
			},
			http: {
				...base.transport.http,
				...override.transport?.http,
			},
		},
		temporal: {
			defaultProfile:
				override.temporal?.defaultProfile ?? base.temporal.defaultProfile,
			profiles: {
				...base.temporal.profiles,
				...override.temporal?.profiles,
			},
		},
		security: {
			...base.security,
			...override.security,
		},
		policy: {
			...base.policy,
			...override.policy,
		},
	};
}

async function tryReadJsonFile(path: string): Promise<unknown | null> {
	try {
		const file = Bun.file(path);
		if (!(await file.exists())) return null;
		return await file.json();
	} catch {
		return null;
	}
}

const CONFIG_CANDIDATES = [
	() => process.env.TEMPORAL_MCP_CONFIG,
	() => join(process.cwd(), '.temporal-mcp.json'),
	() => join(homedir(), '.config', 'temporal-mcp', 'config.json'),
];

export async function loadConfiguration(): Promise<AppConfigContract> {
	for (const getPath of CONFIG_CANDIDATES) {
		const path = getPath();
		if (!path) continue;

		const raw = await tryReadJsonFile(path);
		if (raw === null) continue;

		const parsed = appConfigSchema.safeParse(raw);
		if (!parsed.success) {
			console.error(
				`[temporal-mcp] Invalid config at ${path}: ${parsed.error.message}`,
			);
			continue;
		}

		console.error(`[temporal-mcp] Loaded config from ${path}`);
		return deepMerge(DEFAULT_APP_CONFIG, parsed.data);
	}

	console.error('[temporal-mcp] Using default configuration');
	return DEFAULT_APP_CONFIG;
}
