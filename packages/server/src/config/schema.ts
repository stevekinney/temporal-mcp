import type {
  AppConfigContract,
  HttpTransportConfig,
  McpCapabilitiesConfig,
  SecurityConfig,
  StdioTransportConfig,
  TemporalConfig,
} from '../contracts/config.ts';
import type { PolicyConfig } from '../contracts/policy.ts';

export const DEFAULT_MCP_CAPABILITIES: McpCapabilitiesConfig = {
  tasks: true,
  elicitation: true,
  roots: true,
  completions: true,
};

export const DEFAULT_STDIO_TRANSPORT: StdioTransportConfig = {
  enabled: true,
};

export const DEFAULT_HTTP_TRANSPORT: HttpTransportConfig = {
  enabled: false,
  bind: '127.0.0.1:8080',
  authStrategy: 'internal',
  internalMode: 'localhost',
};

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  confirmTokenTtlSec: 600,
  maxTaskTtlSec: 3600,
  codecAllowlist: [],
  idempotencyWindowSec: 600,
};

export const DEFAULT_TEMPORAL_CONFIG: TemporalConfig = {
  defaultProfile: undefined,
  profiles: {},
};

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  mode: 'readOnly',
  hardReadOnly: false,
  allowedProfiles: [],
  allowedNamespaces: [],
  allowPatterns: [],
  denyPatterns: [],
  breakGlassVariable: 'TEMPORAL_MCP_BREAK_GLASS',
};

export const DEFAULT_APP_CONFIG: AppConfigContract = {
  mcp: {
    capabilities: DEFAULT_MCP_CAPABILITIES,
  },
  transport: {
    mode: 'stdio',
    stdio: DEFAULT_STDIO_TRANSPORT,
    http: DEFAULT_HTTP_TRANSPORT,
  },
  temporal: DEFAULT_TEMPORAL_CONFIG,
  security: DEFAULT_SECURITY_CONFIG,
  policy: DEFAULT_POLICY_CONFIG,
};
