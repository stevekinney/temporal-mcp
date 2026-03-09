import type { RequestContext } from './request-context.ts';
import type { PolicyDecision } from '../contracts/policy.ts';

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
		const sanitized = { ...args };
		const sensitiveKeys = [
			'apiKey',
			'password',
			'token',
			'secret',
			'credential',
		];
		for (const key of Object.keys(sanitized)) {
			if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
				sanitized[key] = '[REDACTED]';
			}
		}
		return sanitized;
	}

	private emit(entry: AuditEntry): void {
		console.error(JSON.stringify(entry));
	}
}
