import { describe, expect, test, mock } from 'bun:test';
import type { Payload } from '@temporalio/common';
import { RemotePayloadCodec } from '../src/payload-codec.ts';

function encryptedPayload(): Payload {
	return {
		metadata: { encoding: new TextEncoder().encode('binary/encrypted') },
		data: new Uint8Array([1, 2, 3]),
	};
}

function jsonPayloadResponse(value: unknown) {
	return {
		payloads: [
			{
				metadata: {
					encoding: Buffer.from('json/plain').toString('base64'),
				},
				data: Buffer.from(JSON.stringify(value)).toString('base64'),
			},
		],
	};
}

async function withMockedFetch<T>(
	handler: (request: Request) => Response | Promise<Response>,
	run: (fetchMock: ReturnType<typeof mock>) => Promise<T>,
): Promise<T> {
	const originalFetch = globalThis.fetch;
	const fetchMock = mock(async (input: any, init: any) =>
		handler(new Request(input, init)),
	);
	globalThis.fetch = fetchMock as any;
	try {
		return await run(fetchMock);
	} finally {
		globalThis.fetch = originalFetch;
	}
}

describe('RemotePayloadCodec', () => {
	describe('wire format', () => {
		test('sends base64 protobuf-JSON payloads to /decode', async () => {
			const codec = new RemotePayloadCodec({
				endpoint: 'https://codec.example.com',
			});

			const requests: Array<{ url: string; body: any }> = [];
			const results = await withMockedFetch(
				async (request) => {
					requests.push({
						url: request.url,
						body: await request.json(),
					});
					return Response.json(jsonPayloadResponse({ hello: 'world' }));
				},
				() => codec.decode([encryptedPayload()]),
			);

			expect(requests[0]!.url).toBe('https://codec.example.com/decode');
			expect(requests[0]!.body).toEqual({
				payloads: [
					{
						metadata: {
							encoding: Buffer.from('binary/encrypted').toString(
								'base64',
							),
						},
						data: Buffer.from(new Uint8Array([1, 2, 3])).toString(
							'base64',
						),
					},
				],
			});

			expect(results).toHaveLength(1);
			expect(
				new TextDecoder().decode(results[0]!.metadata!.encoding),
			).toBe('json/plain');
			expect(
				JSON.parse(new TextDecoder().decode(results[0]!.data!)),
			).toEqual({ hello: 'world' });
		});

		test('posts to /encode for the encode direction', async () => {
			const codec = new RemotePayloadCodec({
				endpoint: 'https://codec.example.com',
			});

			let requestedUrl = '';
			await withMockedFetch(
				(request) => {
					requestedUrl = request.url;
					return Response.json(jsonPayloadResponse({ a: 1 }));
				},
				() => codec.encode([encryptedPayload()]),
			);

			expect(requestedUrl).toBe('https://codec.example.com/encode');
		});

		test('strips trailing slashes from the endpoint', async () => {
			const codec = new RemotePayloadCodec({
				endpoint: 'https://codec.example.com/',
			});

			let requestedUrl = '';
			await withMockedFetch(
				(request) => {
					requestedUrl = request.url;
					return Response.json(jsonPayloadResponse(null));
				},
				() => codec.decode([encryptedPayload()]),
			);

			expect(requestedUrl).toBe('https://codec.example.com/decode');
		});

		test('round-trips payloads with empty data', async () => {
			const codec = new RemotePayloadCodec({
				endpoint: 'https://codec.example.com',
			});

			let sent: any;
			const results = await withMockedFetch(
				async (request) => {
					sent = await request.json();
					return Response.json({
						payloads: [{ metadata: {}, data: '' }],
					});
				},
				() =>
					codec.decode([
						{
							metadata: {
								encoding: new TextEncoder().encode(
									'binary/null',
								),
							},
						},
					]),
			);

			expect(sent.payloads[0].data).toBe('');
			expect(results[0]!.data).toEqual(new Uint8Array());
		});

		test('skips the request entirely for an empty payload list', async () => {
			const codec = new RemotePayloadCodec({
				endpoint: 'https://codec.example.com',
			});

			await withMockedFetch(
				() => Response.json({ payloads: [] }),
				async (fetchMock) => {
					expect(await codec.decode([])).toEqual([]);
					expect(fetchMock).not.toHaveBeenCalled();
				},
			);
		});
	});

	describe('SSRF protection', () => {
		test('refuses private addresses', async () => {
			const codec = new RemotePayloadCodec({
				endpoint: 'http://localhost:8080',
			});

			await withMockedFetch(
				() => Response.json(jsonPayloadResponse(null)),
				async (fetchMock) => {
					await expect(
						codec.decode([encryptedPayload()]),
					).rejects.toThrow(/private address/);
					expect(fetchMock).not.toHaveBeenCalled();
				},
			);
		});

		test('refuses IPv6-mapped private IPv4 addresses', async () => {
			const codec = new RemotePayloadCodec({
				endpoint: 'http://[::ffff:127.0.0.1]:8080',
			});

			await expect(codec.decode([encryptedPayload()])).rejects.toThrow(
				/private address/,
			);
		});

		test('allows private addresses present in the allowlist', async () => {
			const endpoint = 'http://localhost:8080';
			const codec = new RemotePayloadCodec({
				endpoint,
				codecAllowlist: [endpoint],
			});

			const results = await withMockedFetch(
				() => Response.json(jsonPayloadResponse({ ok: true })),
				() => codec.decode([encryptedPayload()]),
			);

			expect(
				JSON.parse(new TextDecoder().decode(results[0]!.data!)),
			).toEqual({ ok: true });
		});
	});

	describe('error handling', () => {
		test('throws on a non-OK codec response', async () => {
			const codec = new RemotePayloadCodec({
				endpoint: 'https://codec.example.com',
			});

			await withMockedFetch(
				() => new Response('nope', { status: 503 }),
				async () => {
					await expect(
						codec.decode([encryptedPayload()]),
					).rejects.toThrow(/status 503/);
				},
			);
		});

		test('throws when the codec returns a mismatched payload count', async () => {
			const codec = new RemotePayloadCodec({
				endpoint: 'https://codec.example.com',
			});

			await withMockedFetch(
				() => Response.json({ payloads: [] }),
				async () => {
					await expect(
						codec.decode([encryptedPayload()]),
					).rejects.toThrow(/returned 0 payloads, expected 1/);
				},
			);
		});

		test('aborts the request once the timeout elapses', async () => {
			const codec = new RemotePayloadCodec({
				endpoint: 'https://codec.example.com',
				codecTimeoutMs: 25,
			});

			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(
				(_input: any, init: any) =>
					new Promise((_resolve, reject) => {
						init.signal.addEventListener('abort', () =>
							reject(new Error('aborted')),
						);
					}),
			) as any;

			try {
				await expect(
					codec.decode([encryptedPayload()]),
				).rejects.toThrow();
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});
});
