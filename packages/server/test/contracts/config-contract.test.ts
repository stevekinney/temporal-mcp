import { describe, expect, test } from 'bun:test';
import type { AppConfigContract, ProfileKind } from '../../src/contracts/config';

describe('config contract types', () => {
  test('profile kind only accepts cloud or self-hosted values', () => {
    const kinds: ProfileKind[] = ['self-hosted', 'cloud'];
    expect(kinds).toEqual(['self-hosted', 'cloud']);
  });

  test('sample app config satisfies contract shape', () => {
    const config: AppConfigContract = {
      mcp: {
        capabilities: {
          tasks: true,
          elicitation: true,
          roots: true,
          completions: true,
        },
      },
      transport: {
        mode: 'stdio',
        stdio: { enabled: true },
        http: {
          enabled: false,
          bind: '127.0.0.1:8080',
          authStrategy: 'internal',
          internalMode: 'localhost',
        },
      },
      temporal: {
        defaultProfile: 'dev',
        profiles: {
          dev: {
            kind: 'self-hosted',
            address: 'localhost:7233',
            namespace: 'default',
          },
        },
      },
      security: {
        confirmTokenTtlSec: 600,
        maxTaskTtlSec: 3600,
        codecAllowlist: ['https://codec.internal.example'],
        idempotencyWindowSec: 600,
      },
      policy: {
        mode: 'readOnly',
        hardReadOnly: false,
        allowedProfiles: [],
        allowedNamespaces: [],
        allowPatterns: [],
        denyPatterns: [],
        breakGlassVariable: 'TEMPORAL_MCP_BREAK_GLASS',
      },
    };

    const devProfile = config.temporal.profiles.dev;
    expect(devProfile).toBeDefined();
    expect(devProfile?.kind).toBe('self-hosted');
    expect(config.mcp.capabilities.completions).toBeTrue();
    expect(config.security.codecAllowlist.length).toBe(1);
  });
});
