import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { PayloadDecoder } from '../src/payload-decoder.ts';

describe('PayloadDecoder', () => {
	describe('JSON payload decoding', () => {
		test('decodes JSON payload with string encoding', async () => {
			const decoder = new PayloadDecoder();
			const payload = {
				metadata: { encoding: 'json/plain' },
				data: JSON.stringify({ hello: 'world' }),
			};

			const results = await decoder.decode([payload]);
			expect(results).toHaveLength(1);
			expect(results[0]!.decoded).toBe(true);
			expect(results[0]!.data).toEqual({ hello: 'world' });
		});

		test('decodes JSON payload with application/json encoding', async () => {
			const decoder = new PayloadDecoder();
			const payload = {
				metadata: { encoding: 'application/json' },
				data: JSON.stringify({ count: 42 }),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(true);
			expect(results[0]!.data).toEqual({ count: 42 });
		});

		test('decodes JSON payload with Uint8Array data', async () => {
			const decoder = new PayloadDecoder();
			const payload = {
				metadata: { encoding: 'json/plain' },
				data: new TextEncoder().encode(
					JSON.stringify({ value: 'encoded' }),
				),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(true);
			expect(results[0]!.data).toEqual({ value: 'encoded' });
		});

		test('decodes JSON payload with Uint8Array encoding metadata', async () => {
			const decoder = new PayloadDecoder();
			const payload = {
				metadata: {
					encoding: new TextEncoder().encode('json/plain'),
				},
				data: JSON.stringify({ key: 'val' }),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(true);
			expect(results[0]!.data).toEqual({ key: 'val' });
		});
	});

	describe('non-JSON payloads without codec', () => {
		test('returns decoded: false with reason', async () => {
			const decoder = new PayloadDecoder();
			const payload = {
				metadata: { encoding: 'binary/protobuf' },
				data: new Uint8Array([1, 2, 3]),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(false);
			expect(results[0]!.reason).toContain(
				'No codec endpoint configured',
			);
			expect(results[0]!.encoding).toBe('binary/protobuf');
		});

		test('returns unknown encoding for payloads without metadata', async () => {
			const decoder = new PayloadDecoder();
			const payload = { data: 'something' };

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(false);
			expect(results[0]!.encoding).toBe('unknown');
		});

		test('returns unknown encoding for non-object payloads', async () => {
			const decoder = new PayloadDecoder();
			const results = await decoder.decode(['just a string']);
			expect(results[0]!.decoded).toBe(false);
			expect(results[0]!.encoding).toBe('unknown');
		});
	});

	describe('SSRF protection', () => {
		test('blocks private addresses (localhost)', async () => {
			const decoder = new PayloadDecoder({
				codecEndpoint: 'http://localhost:8080/decode',
			});
			const payload = {
				metadata: { encoding: 'binary/encrypted' },
				data: new Uint8Array([1, 2, 3]),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(false);
			expect(results[0]!.reason).toContain('private address');
		});

		test('blocks private addresses (10.x.x.x)', async () => {
			const decoder = new PayloadDecoder({
				codecEndpoint: 'http://10.0.0.1:8080/decode',
			});
			const payload = {
				metadata: { encoding: 'binary/encrypted' },
				data: new Uint8Array([1, 2, 3]),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(false);
			expect(results[0]!.reason).toContain('private address');
		});

		test('blocks private addresses (192.168.x.x)', async () => {
			const decoder = new PayloadDecoder({
				codecEndpoint: 'http://192.168.1.1:8080/decode',
			});
			const payload = {
				metadata: { encoding: 'binary/encrypted' },
				data: new Uint8Array([1, 2, 3]),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(false);
			expect(results[0]!.reason).toContain('private address');
		});

		test('blocks private addresses (127.x.x.x)', async () => {
			const decoder = new PayloadDecoder({
				codecEndpoint: 'http://127.0.0.1:8080/decode',
			});
			const payload = {
				metadata: { encoding: 'binary/encrypted' },
				data: new Uint8Array([1, 2, 3]),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(false);
			expect(results[0]!.reason).toContain('private address');
		});

		test('blocks private IPv6 loopback addresses', async () => {
			const decoder = new PayloadDecoder({
				codecEndpoint: 'http://[::1]:8080/decode',
			});
			const payload = {
				metadata: { encoding: 'binary/encrypted' },
				data: new Uint8Array([1, 2, 3]),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(false);
			expect(results[0]!.reason).toContain('private address');
		});

		test('blocks private IPv6-mapped IPv4 addresses', async () => {
			const decoder = new PayloadDecoder({
				codecEndpoint: 'http://[::ffff:127.0.0.1]:8080/decode',
			});
			const payload = {
				metadata: { encoding: 'binary/encrypted' },
				data: new Uint8Array([1, 2, 3]),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(false);
			expect(results[0]!.reason).toContain('private address');
		});

		test('allows public hostnames that start with "fc"', async () => {
			const decoder = new PayloadDecoder({
				codecEndpoint: 'https://fc.example.com/decode',
			});
			const originalFetch = globalThis.fetch;
			const fetchMock = mock(async () =>
				new Response(
					JSON.stringify({
						payloads: [{ value: 'decoded' }],
					}),
					{ status: 200 },
				),
			) as any;
			globalThis.fetch = fetchMock;

			try {
				const payload = {
					metadata: { encoding: 'binary/encrypted' },
					data: new Uint8Array([1, 2, 3]),
				};

				const results = await decoder.decode([payload]);
				expect(results[0]!.decoded).toBe(true);
				expect(fetchMock).toHaveBeenCalled();
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});

	describe('allowed private addresses', () => {
		test('allows private addresses in the allowlist', async () => {
			const codecEndpoint = 'http://localhost:8080/decode';
			const decoder = new PayloadDecoder({
				codecEndpoint,
				codecAllowlist: [codecEndpoint],
			});

			// We need to mock fetch for this test
			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(async () =>
				new Response(
					JSON.stringify({
						payloads: [{ decoded: true, value: 'hello' }],
					}),
					{ status: 200 },
				),
			) as any;

			try {
				const payload = {
					metadata: { encoding: 'binary/encrypted' },
					data: new Uint8Array([1, 2, 3]),
				};

				const results = await decoder.decode([payload]);
				expect(results[0]!.decoded).toBe(true);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});

	describe('codec timeout handling', () => {
		test('handles codec timeout gracefully', async () => {
			const decoder = new PayloadDecoder({
				codecEndpoint: 'https://codec.example.com/decode',
				codecTimeoutMs: 50, // Very short timeout
			});

			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(
				async () =>
					new Promise((resolve) => {
						// Simulate a slow response that exceeds timeout
						setTimeout(
							() =>
								resolve(
									new Response(
										JSON.stringify({ payloads: [] }),
									),
								),
							200,
						);
					}),
			) as any;

			try {
				const payload = {
					metadata: { encoding: 'binary/encrypted' },
					data: new Uint8Array([1, 2, 3]),
				};

				const results = await decoder.decode([payload]);
				// Should fallback gracefully when the codec times out
				expect(results[0]!.decoded).toBe(false);
				expect(results[0]!.reason).toBeDefined();
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});

	describe('graceful fallback', () => {
		test('returns encoding info for undecodable payloads', async () => {
			const decoder = new PayloadDecoder();
			const payload = {
				metadata: {
					encoding: new TextEncoder().encode(
						'binary/custom-format',
					),
				},
				data: new Uint8Array([0xff, 0xfe]),
			};

			const results = await decoder.decode([payload]);
			expect(results[0]!.decoded).toBe(false);
			expect(results[0]!.encoding).toBe('binary/custom-format');
		});

		test('decodes multiple payloads in parallel', async () => {
			const decoder = new PayloadDecoder();
			const payloads = [
				{
					metadata: { encoding: 'json/plain' },
					data: JSON.stringify({ a: 1 }),
				},
				{
					metadata: { encoding: 'binary/protobuf' },
					data: new Uint8Array([1]),
				},
				{
					metadata: { encoding: 'json/plain' },
					data: JSON.stringify({ b: 2 }),
				},
			];

			const results = await decoder.decode(payloads);
			expect(results).toHaveLength(3);
			expect(results[0]!.decoded).toBe(true);
			expect(results[0]!.data).toEqual({ a: 1 });
			expect(results[1]!.decoded).toBe(false);
			expect(results[2]!.decoded).toBe(true);
			expect(results[2]!.data).toEqual({ b: 2 });
		});
	});

	describe('codec response handling', () => {
		test('accepts falsy decoded payload values from codec', async () => {
			const decoder = new PayloadDecoder({
				codecEndpoint: 'https://codec.example.com/decode',
			});
			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(async () =>
				new Response(
					JSON.stringify({
						payloads: [0],
					}),
					{ status: 200 },
				),
			) as any;

			try {
				const payload = {
					metadata: { encoding: 'binary/encrypted' },
					data: new Uint8Array([1, 2, 3]),
				};
				const results = await decoder.decode([payload]);
				expect(results[0]!.decoded).toBe(true);
				expect(results[0]!.data).toBe(0);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});
});
