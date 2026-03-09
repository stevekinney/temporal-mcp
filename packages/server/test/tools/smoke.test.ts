import {
	afterAll,
	beforeAll,
	describe,
	expect,
	test,
} from 'bun:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEMPORAL_ADDRESS = 'localhost:7233';

async function isTemporalReachable(): Promise<boolean> {
	try {
		const socket = await Bun.connect({
			hostname: 'localhost',
			port: 7233,
			socket: {
				data() {},
				open(socket) {
					socket.end();
				},
				error() {},
			},
		});
		socket.end();
		return true;
	} catch {
		return false;
	}
}

describe('End-to-end smoke test', () => {
	let process: ReturnType<typeof Bun.spawn> | null = null;
	let configPath: string;
	let reader: { read(): Promise<{ value: string | undefined; done: boolean }> };
	let available = false;

	beforeAll(async () => {
		available = await isTemporalReachable();
		if (!available) return;

		configPath = join(tmpdir(), `temporal-mcp-smoke-${Date.now()}.json`);
		await Bun.write(
			configPath,
			JSON.stringify({
				temporal: {
					defaultProfile: 'local',
					profiles: {
						local: {
							kind: 'self-hosted',
							address: TEMPORAL_ADDRESS,
							namespace: 'default',
						},
					},
				},
			}),
		);

		const entryPoint = join(import.meta.dir, '..', '..', '..', '..', 'src', 'index.ts');

		process = Bun.spawn(['bun', entryPoint], {
			env: { ...Bun.env, TEMPORAL_MCP_CONFIG: configPath },
			stdin: 'pipe',
			stdout: 'pipe',
			stderr: 'inherit',
		});

		const stdout = process.stdout as ReadableStream<Uint8Array>;
		const textStream = stdout.pipeThrough(new TextDecoderStream() as any);
		reader = textStream.getReader() as any;

		// Give the server a moment to start
		await Bun.sleep(500);
	});

	afterAll(async () => {
		if (process) {
			process.kill();
			await process.exited;
		}
		if (configPath) {
			try {
				const { unlink } = await import('node:fs/promises');
				await unlink(configPath);
			} catch {}
		}
	});

	function skipIfUnavailable() {
		if (!available) {
			console.log('Skipping: Temporal server not reachable at localhost:7233');
		}
		return !available;
	}

	async function send(message: object): Promise<void> {
		const line = JSON.stringify(message) + '\n';
		const stdin = process!.stdin as import('bun').FileSink;
		stdin.write(line);
		await stdin.flush();
	}

	async function readResponse(timeoutMs = 5000): Promise<any> {
		const deadline = Date.now() + timeoutMs;
		let buffer = '';

		while (Date.now() < deadline) {
			const { value, done } = await Promise.race([
				reader.read(),
				Bun.sleep(100).then(() => ({ value: undefined, done: false })),
			]);

			if (done) throw new Error('stdout stream ended unexpectedly');
			if (value) {
				buffer += value;
				const lines = buffer.split('\n');
				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;
					try {
						return JSON.parse(trimmed);
					} catch {
						// Not yet a complete JSON line, keep reading
					}
				}
				// Keep the last incomplete line in the buffer
				buffer = lines[lines.length - 1] ?? '';
			}
		}
		throw new Error(`Timed out waiting for response after ${timeoutMs}ms`);
	}

	async function sendAndReceive(message: object): Promise<any> {
		await send(message);
		return readResponse();
	}

	test('completes MCP initialization handshake', async () => {
		if (skipIfUnavailable()) return;

		const initResponse = await sendAndReceive({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2024-11-05',
				capabilities: {},
				clientInfo: { name: 'smoke-test', version: '1.0.0' },
			},
		});

		expect(initResponse.jsonrpc).toBe('2.0');
		expect(initResponse.id).toBe(1);
		expect(initResponse.result).toBeDefined();
		expect(initResponse.result.serverInfo).toBeDefined();

		// Send initialized notification (no response expected)
		await send({
			jsonrpc: '2.0',
			method: 'notifications/initialized',
		});

		await Bun.sleep(100);
	});

	test('lists registered tools via tools/list', async () => {
		if (skipIfUnavailable()) return;

		const response = await sendAndReceive({
			jsonrpc: '2.0',
			id: 2,
			method: 'tools/list',
			params: {},
		});

		expect(response.id).toBe(2);
		expect(response.result.tools).toBeArray();

		const toolNames = response.result.tools.map(
			(tool: { name: string }) => tool.name,
		);
		expect(toolNames).toContain('temporal.workflow.list');
		expect(toolNames).toContain('temporal.workflow.describe');
	});

	test('calls temporal.workflow.list and gets ok: true response', async () => {
		if (skipIfUnavailable()) return;

		const response = await sendAndReceive({
			jsonrpc: '2.0',
			id: 3,
			method: 'tools/call',
			params: {
				name: 'temporal.workflow.list',
				arguments: { pageSize: 5 },
			},
		});

		expect(response.id).toBe(3);
		expect(response.result.content).toBeArray();

		const parsed = JSON.parse(response.result.content[0].text);
		expect(parsed.ok).toBe(true);
		expect(parsed.data).toBeArray();
	});

	test('calls temporal.workflow.describe with nonexistent workflow and gets error', async () => {
		if (skipIfUnavailable()) return;

		const response = await sendAndReceive({
			jsonrpc: '2.0',
			id: 4,
			method: 'tools/call',
			params: {
				name: 'temporal.workflow.describe',
				arguments: { workflowId: 'nonexistent-workflow-id-smoke-test' },
			},
		});

		expect(response.id).toBe(4);
		expect(response.result.isError).toBe(true);

		const parsed = JSON.parse(response.result.content[0].text);
		expect(parsed.ok).toBe(false);
		expect(parsed.error).toBeDefined();
	});
});
