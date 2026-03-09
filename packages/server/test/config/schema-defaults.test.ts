import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_HTTP_TRANSPORT,
  DEFAULT_MCP_CAPABILITIES,
  DEFAULT_SECURITY_CONFIG,
  DEFAULT_STDIO_TRANSPORT,
  DEFAULT_TEMPORAL_CONFIG,
} from '../../src/config/schema';

describe('config defaults', () => {
  test('locked capability keys exist and default to true', () => {
    expect(Object.keys(DEFAULT_MCP_CAPABILITIES).sort()).toEqual([
      'completions',
      'elicitation',
      'roots',
      'tasks',
    ]);

    expect(DEFAULT_MCP_CAPABILITIES).toEqual({
      tasks: true,
      elicitation: true,
      roots: true,
      completions: true,
    });
  });

  test('transport defaults match locked execution plan', () => {
    expect(DEFAULT_STDIO_TRANSPORT).toEqual({ enabled: true });
    expect(DEFAULT_HTTP_TRANSPORT).toEqual({
      enabled: false,
      bind: '127.0.0.1:8080',
      authStrategy: 'internal',
      internalMode: 'localhost',
    });
  });

  test('security defaults expose all required keys', () => {
    expect(DEFAULT_SECURITY_CONFIG).toEqual({
      confirmTokenTtlSec: 600,
      maxTaskTtlSec: 3600,
      codecAllowlist: [],
      idempotencyWindowSec: 600,
    });
  });

  test('app default object composes subsystem defaults', () => {
    expect(DEFAULT_APP_CONFIG.transport.mode).toBe('stdio');
    expect(DEFAULT_APP_CONFIG.transport.stdio).toBe(DEFAULT_STDIO_TRANSPORT);
    expect(DEFAULT_APP_CONFIG.transport.http).toBe(DEFAULT_HTTP_TRANSPORT);
    expect(DEFAULT_APP_CONFIG.mcp.capabilities).toBe(DEFAULT_MCP_CAPABILITIES);
    expect(DEFAULT_APP_CONFIG.temporal).toBe(DEFAULT_TEMPORAL_CONFIG);
    expect(DEFAULT_APP_CONFIG.security).toBe(DEFAULT_SECURITY_CONFIG);
  });

  test('temporal defaults start with no configured profiles', () => {
    expect(DEFAULT_TEMPORAL_CONFIG.defaultProfile).toBeUndefined();
    expect(DEFAULT_TEMPORAL_CONFIG.profiles).toEqual({});
  });
});
