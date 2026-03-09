import type { RequestContext } from './request-context.ts';
import type { PolicyDecision } from '../contracts/policy.ts';
import { redactSensitiveFields } from './redaction.ts';

export interface AuditEntry {
	type: 'tool_call' | 'tool_result' | 'policy_decision';
	context: RequestContext;
	timestamp: string;
	[key: string]: unknown;
}

export class AuditLogger {
	logToolCall(context: RequestContext, args: Record<string, unknown>): void {
		const entry: AuditEntry = {
			type: 'tool_call',
			context,
			timestamp: new Date().toISOString(),
			args: this.sanitizeArgs(args),
		};
		this.emit(entry);
	}

	logToolResult(
		context: RequestContext,
		status: 'success' | 'error',
		durationMs: number,
	): void {
		const entry: AuditEntry = {
			type: 'tool_result',
			context,
			timestamp: new Date().toISOString(),
			status,
			durationMs,
		};
		this.emit(entry);
	}

	logPolicyDecision(
		context: RequestContext,
		decision: PolicyDecision,
	): void {
		const entry: AuditEntry = {
			type: 'policy_decision',
			context,
			timestamp: new Date().toISOString(),
			decision,
		};
		this.emit(entry);
	}

	private sanitizeArgs(
		args: Record<string, unknown>,
	): Record<string, unknown> {
		return redactSensitiveFields(args) as Record<string, unknown>;
	}

	private emit(entry: AuditEntry): void {
		console.error(JSON.stringify(entry));
	}
}
