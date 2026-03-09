import { describe, expect, test } from 'bun:test';
import type {
  ErrorEnvelope,
  ErrorObject,
  ResultEnvelope,
  SuccessEnvelope,
} from '../../src/contracts/error-envelope';

describe('error envelope contracts', () => {
  test('error envelope shape is usable at runtime', () => {
    const errorObject: ErrorObject = {
      code: 'policy_denied',
      message: 'Tool is not allowed by current policy',
      retryable: false,
      details: { tool: 'temporal.workflow.terminate' },
    };

    const envelope: ErrorEnvelope = {
      ok: false,
      error: errorObject,
    };

    expect(envelope.ok).toBeFalse();
    expect(envelope.error.code).toBe('policy_denied');
    expect(envelope.error.details).toEqual({
      tool: 'temporal.workflow.terminate',
    });
  });

  test('result envelope discriminates success and error', () => {
    const success: SuccessEnvelope<{ id: string }> = {
      ok: true,
      data: { id: 'wf-123' },
    };
    const failure: ErrorEnvelope = {
      ok: false,
      error: { code: 'not_found', message: 'workflow not found' },
    };

    const responses: ResultEnvelope<{ id: string }>[] = [success, failure];

    expect(responses.filter((r) => r.ok).length).toBe(1);
    expect(responses.filter((r) => !r.ok).length).toBe(1);
  });
});
