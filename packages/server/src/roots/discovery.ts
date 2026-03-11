import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface Root {
	uri: string;
	name?: string;
}

export class RootsDiscovery {
	private roots: Root[] = [];
	private listeners: Array<(roots: Root[]) => void> = [];

	async initialize(server: McpServer): Promise<void> {
		try {
			const capabilities = (
				server.server as any
			).getClientCapabilities?.();
			if (!capabilities?.roots?.listChanged) return;

			// Fetch initial roots
			const result = await (server.server as any).listRoots?.();
			if (result?.roots) {
				this.roots = result.roots;
			}

			// Subscribe to changes (if the API supports it)
			// The MCP SDK may fire notifications/roots/list_changed
		} catch {
			// Client doesn't support roots -- that's fine
		}
	}

	getRoots(): readonly Root[] {
		return this.roots;
	}

	onRootsChanged(callback: (roots: Root[]) => void): void {
		this.listeners.push(callback);
	}

	/** Called when roots change notification is received */
	handleRootsChanged(newRoots: Root[]): void {
		this.roots = newRoots;
		for (const listener of this.listeners) {
			listener(newRoots);
		}
	}
}
