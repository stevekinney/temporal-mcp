import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

export interface LogMessage {
	level: LogLevel;
	logger?: string;
	data: unknown;
}

export class McpLogger {
	constructor(private server: McpServer) {}

	log(message: LogMessage): void {
		// Log to stderr for stdio transport visibility
		const prefix = message.logger ? `[${message.logger}]` : '[temporal-mcp]';
		const dataStr = typeof message.data === 'string' ? message.data : JSON.stringify(message.data);
		console.error(`${prefix} ${message.level}: ${dataStr}`);

		// Also send via MCP logging protocol
		try {
			this.server.server.sendLoggingMessage({
				level: message.level,
				logger: message.logger ?? 'temporal-mcp',
				data: message.data,
			});
		} catch {
			// Ignore if server not yet connected or logging not supported
		}
	}

	info(data: unknown, logger?: string): void {
		this.log({ level: 'info', logger, data });
	}

	warning(data: unknown, logger?: string): void {
		this.log({ level: 'warning', logger, data });
	}

	error(data: unknown, logger?: string): void {
		this.log({ level: 'error', logger, data });
	}

	debug(data: unknown, logger?: string): void {
		this.log({ level: 'debug', logger, data });
	}
}
