import type { Payload, PayloadCodec } from '@temporalio/common';
import {
	DEFAULT_CODEC_TIMEOUT_MS,
	codecEndpointBlockedReason,
	postToCodecEndpoint,
} from './codec-endpoint.ts';

export interface RemotePayloadCodecOptions {
	endpoint: string;
	codecAllowlist?: readonly string[];
	codecTimeoutMs?: number;
}

type CodecOperation = 'encode' | 'decode';

/**
 * Protobuf-JSON representation of `temporal.api.common.v1.Payload`: `bytes`
 * fields are base64 strings on the wire.
 */
interface JsonPayload {
	metadata: Record<string, string>;
	data: string;
}

function toJsonPayload(payload: Payload): JsonPayload {
	const metadata: Record<string, string> = {};
	for (const [key, value] of Object.entries(payload.metadata ?? {})) {
		metadata[key] = Buffer.from(value).toString('base64');
	}
	return {
		metadata,
		data: payload.data
			? Buffer.from(payload.data).toString('base64')
			: '',
	};
}

function fromJsonPayload(payload: JsonPayload): Payload {
	const metadata: Record<string, Uint8Array> = {};
	for (const [key, value] of Object.entries(payload.metadata ?? {})) {
		metadata[key] = new Uint8Array(Buffer.from(value, 'base64'));
	}
	return {
		metadata,
		data: new Uint8Array(Buffer.from(payload.data ?? '', 'base64')),
	};
}

/**
 * `PayloadCodec` backed by a remote codec server exposing `POST /encode` and
 * `POST /decode`, the shape Temporal's own tooling speaks.
 */
export class RemotePayloadCodec implements PayloadCodec {
	private readonly endpoint: string;
	private readonly codecAllowlist: readonly string[];
	private readonly codecTimeoutMs: number;

	constructor(options: RemotePayloadCodecOptions) {
		this.endpoint = options.endpoint.replace(/\/+$/, '');
		this.codecAllowlist = options.codecAllowlist ?? [];
		this.codecTimeoutMs =
			options.codecTimeoutMs ?? DEFAULT_CODEC_TIMEOUT_MS;
	}

	async encode(payloads: Payload[]): Promise<Payload[]> {
		return this.call('encode', payloads);
	}

	async decode(payloads: Payload[]): Promise<Payload[]> {
		return this.call('decode', payloads);
	}

	private async call(
		operation: CodecOperation,
		payloads: Payload[],
	): Promise<Payload[]> {
		if (payloads.length === 0) return payloads;

		const blocked = codecEndpointBlockedReason(
			this.endpoint,
			this.codecAllowlist,
		);
		if (blocked) {
			throw new Error(`Codec ${operation} refused: ${blocked}`);
		}

		const response = await postToCodecEndpoint(
			`${this.endpoint}/${operation}`,
			{ payloads: payloads.map(toJsonPayload) },
			this.codecTimeoutMs,
		);

		if (!response.ok) {
			throw new Error(
				`Codec ${operation} failed with status ${response.status}`,
			);
		}

		const body = (await response.json()) as {
			payloads?: JsonPayload[];
		};
		const returned = body.payloads;
		if (!Array.isArray(returned) || returned.length !== payloads.length) {
			throw new Error(
				`Codec ${operation} returned ${returned?.length ?? 0} payloads, expected ${payloads.length}`,
			);
		}

		return returned.map(fromJsonPayload);
	}
}
