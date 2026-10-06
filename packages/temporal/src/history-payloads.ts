import type { Client } from '@temporalio/client';
import type { Payload, PayloadCodec } from '@temporalio/common';
import { PayloadDecoder } from './payload-decoder.ts';

/**
 * History arrives over the raw gRPC path, which bypasses the client's data
 * converter. These helpers run the client's configured codecs over the
 * payloads embedded in history events so encrypted histories read as
 * plaintext.
 */
export function getClientPayloadCodecs(client: Client): PayloadCodec[] {
	return client.options?.loadedDataConverter?.payloadCodecs ?? [];
}

function isPayload(value: unknown): value is Payload {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	const metadata = candidate.metadata;
	if (typeof metadata !== 'object' || metadata === null) return false;
	if (!((metadata as Record<string, unknown>).encoding instanceof Uint8Array)) {
		return false;
	}
	const data = candidate.data;
	return data === undefined || data === null || data instanceof Uint8Array;
}

function isTraversable(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		!(value instanceof Uint8Array) &&
		!(value instanceof Date)
	);
}

function collectPayloads(value: unknown, found: Payload[]): void {
	if (isPayload(value)) {
		found.push(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) collectPayloads(entry, found);
		return;
	}
	if (isTraversable(value)) {
		for (const entry of Object.values(value)) collectPayloads(entry, found);
	}
}

function replacePayloads(
	value: unknown,
	replacements: Map<unknown, unknown>,
): unknown {
	if (replacements.has(value)) return replacements.get(value);

	if (Array.isArray(value)) {
		let changed = false;
		const next = value.map((entry) => {
			const replaced = replacePayloads(entry, replacements);
			if (replaced !== entry) changed = true;
			return replaced;
		});
		return changed ? next : value;
	}

	if (isTraversable(value)) {
		let changed = false;
		const next: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			const replaced = replacePayloads(entry, replacements);
			if (replaced !== entry) changed = true;
			next[key] = replaced;
		}
		return changed ? next : value;
	}

	return value;
}

/**
 * Replace every payload nested anywhere in `value` with its decoded form.
 * Payloads the codecs cannot turn into JSON keep their encoding and the reason
 * they stayed opaque, so decode provenance survives into the response.
 */
export async function decodeHistoryPayloads<T>(
	value: T,
	codecs: readonly PayloadCodec[],
): Promise<T> {
	if (codecs.length === 0) return value;

	const found: Payload[] = [];
	collectPayloads(value, found);
	if (found.length === 0) return value;

	let payloads = found;
	for (const codec of codecs) {
		payloads = await codec.decode(payloads);
	}

	const decoded = await new PayloadDecoder().decode(payloads);
	const replacements = new Map<unknown, unknown>();
	found.forEach((payload, index) => {
		const result = decoded[index]!;
		replacements.set(
			payload,
			result.decoded
				? result.data
				: {
						decoded: false,
						encoding: result.encoding,
						reason: result.reason,
					},
		);
	});

	return replacePayloads(value, replacements) as T;
}
