import { describe, expect, test } from 'bun:test';
import type { Payload, PayloadCodec } from '@temporalio/common';
import { decodeHistoryPayloads } from '../src/history-payloads.ts';

function payload(encoding: string, data: string): Payload {
	return {
		metadata: { encoding: new TextEncoder().encode(encoding) },
		data: new TextEncoder().encode(data),
	};
}

/** Stands in for a codec server that turns ciphertext back into JSON. */
function decryptingCodec(): PayloadCodec & { decodedBatches: number } {
	const codec = {
		decodedBatches: 0,
		async encode(payloads: Payload[]) {
			return payloads;
		},
		async decode(payloads: Payload[]) {
			codec.decodedBatches += 1;
			return payloads.map((entry) => {
				const encoding = new TextDecoder().decode(
					entry.metadata!.encoding!,
				);
				if (encoding !== 'binary/encrypted') return entry;
				const plaintext = new TextDecoder()
					.decode(entry.data!)
					.replace('cipher:', '');
				return payload('json/plain', plaintext);
			});
		},
	};
	return codec;
}

describe('decodeHistoryPayloads', () => {
	test('leaves the value untouched when no codecs are configured', async () => {
		const events: any[] = [
			{
				eventType: 'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED',
				attributes: {
					input: { payloads: [payload('binary/encrypted', 'x')] },
				},
			},
		];

		expect(await decodeHistoryPayloads(events, [])).toBe(events);
	});

	test('decodes payloads nested in event attributes', async () => {
		const events: any[] = [
			{
				eventId: '1',
				eventType: 'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED',
				attributes: {
					input: {
						payloads: [
							payload('binary/encrypted', 'cipher:{"order":7}'),
						],
					},
				},
			},
		];

		const decoded = await decodeHistoryPayloads(events, [
			decryptingCodec(),
		]);

		expect(decoded[0]!.attributes.input.payloads[0]).toEqual({ order: 7 });
		expect(decoded[0]!.eventType).toBe(
			'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED',
		);
	});

	test('decodes single-payload maps such as memo and search attributes', async () => {
		const events: any[] = [
			{
				attributes: {
					memo: {
						fields: {
							note: payload(
								'binary/encrypted',
								'cipher:"private"',
							),
						},
					},
					searchAttributes: {
						indexedFields: {
							CustomKeywordField: payload(
								'json/plain',
								'"visible"',
							),
						},
					},
				},
			},
		];

		const decoded = await decodeHistoryPayloads(events, [
			decryptingCodec(),
		]);

		expect(decoded[0]!.attributes.memo.fields.note).toBe('private');
		expect(
			decoded[0]!.attributes.searchAttributes.indexedFields
				.CustomKeywordField,
		).toBe('visible');
	});

	test('decodes every payload in the history in a single codec batch', async () => {
		const codec = decryptingCodec();
		const events: any[] = [
			{
				attributes: {
					input: {
						payloads: [payload('binary/encrypted', 'cipher:1')],
					},
				},
			},
			{
				attributes: {
					result: {
						payloads: [payload('binary/encrypted', 'cipher:2')],
					},
				},
			},
		];

		const decoded = await decodeHistoryPayloads(events, [codec]);

		expect(codec.decodedBatches).toBe(1);
		expect(decoded[0]!.attributes.input.payloads[0]).toBe(1);
		expect(decoded[1]!.attributes.result.payloads[0]).toBe(2);
	});

	test('keeps encoding and reason for payloads the codec cannot decode', async () => {
		const events: any[] = [
			{
				attributes: {
					input: {
						payloads: [payload('binary/protobuf', 'opaque')],
					},
				},
			},
		];

		const decoded = await decodeHistoryPayloads(events, [
			decryptingCodec(),
		]);

		expect(decoded[0]!.attributes.input.payloads[0]).toMatchObject({
			decoded: false,
			encoding: 'binary/protobuf',
		});
	});

	test('runs codecs in reverse-of-encode order for decoding chains', async () => {
		const order: string[] = [];
		const recording = (name: string): PayloadCodec => ({
			async encode(payloads) {
				return payloads;
			},
			async decode(payloads) {
				order.push(name);
				return payloads;
			},
		});

		await decodeHistoryPayloads(
			[{ payloads: [payload('json/plain', '1')] }],
			[recording('outer'), recording('inner')],
		);

		expect(order).toEqual(['outer', 'inner']);
	});

	test('returns the original value when it holds no payloads', async () => {
		const events: any[] = [{ eventId: '1', attributes: { attempt: 2 } }];

		expect(await decodeHistoryPayloads(events, [decryptingCodec()])).toBe(
			events,
		);
	});
});
