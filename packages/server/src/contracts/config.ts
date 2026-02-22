export type ProfileKind = 'selfHosted' | 'cloud';

export interface McpCapabilitiesConfig {
  tasks: boolean;
  elicitation: boolean;
  roots: boolean;
  completions: boolean;
}

export interface StdioTransportConfig {
  enabled: boolean;
}

export interface HttpTransportConfig {
  enabled: boolean;
  bind: string;
  authStrategy: 'oauth' | 'internal';
  internalMode?: 'localhost' | 'private-network';
}

export interface TransportConfig {
  mode: 'stdio' | 'http';
  stdio: StdioTransportConfig;
  http: HttpTransportConfig;
}

export interface SecurityConfig {
  confirmTokenTtlSec: number;
  maxTaskTtlSec: number;
  codecAllowlist: string[];
  idempotencyWindowSec: number;
}

export interface TemporalProfileConfig {
  kind: ProfileKind;
  address: string;
  namespace: string;
}

export interface TemporalConfig {
  defaultProfile?: string;
  profiles: Record<string, TemporalProfileConfig>;
}

export interface AppConfigContract {
  mcp: {
    capabilities: McpCapabilitiesConfig;
  };
  transport: TransportConfig;
  temporal: TemporalConfig;
  security: SecurityConfig;
}
