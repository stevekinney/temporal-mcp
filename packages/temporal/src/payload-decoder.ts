import {
	DEFAULT_CODEC_TIMEOUT_MS,
	codecEndpointBlockedReason,
	postToCodecEndpoint,
} from './codec-endpoint.ts';

export interface DecodedPayload {
	decoded: boolean;
	data?: unknown;
	encoding?: string;
	reason?: string;
}

export class PayloadDecoder {
	private codecEndpoint?: string;
	private codecAllowlist: string[];
	private codecTimeoutMs: number;

	constructor(options?: {
		codecEndpoint?: string;
		codecAllowlist?: string[];
		codecTimeoutMs?: number;
	}) {
		this.codecEndpoint = options?.codecEndpoint;
		this.codecAllowlist = options?.codecAllowlist ?? [];
		this.codecTimeoutMs = options?.codecTimeoutMs ?? DEFAULT_CODEC_TIMEOUT_MS;
	}

	async decode(payloads: unknown[]): Promise<DecodedPayload[]> {
		return Promise.all(
			payloads.map((payload) => this.decodeSingle(payload)),
		);
	}

	private async decodeSingle(payload: unknown): Promise<DecodedPayload> {
		// Stage 1: Try JSON decode (default Temporal SDK behavior)
		if (this.isJsonPayload(payload)) {
			try {
				const data = this.decodeJsonPayload(payload);
				return { decoded: true, data };
			} catch {
				// Fall through to next stage
			}
		}

		// Stage 2: Try remote codec if configured
		if (this.codecEndpoint) {
			try {
				return await this.decodeViaCodec(payload);
			} catch {
				// Fall through to graceful fallback
			}
		}

		// Stage 3: Graceful fallback
		const encoding = this.getEncoding(payload);
		return {
			decoded: false,
			encoding,
			reason: this.codecEndpoint
				? 'Codec endpoint failed to decode payload'
				: 'No codec endpoint configured and payload is not JSON',
		};
	}

	private isJsonPayload(payload: unknown): boolean {
		if (typeof payload !== 'object' || payload === null) return false;
		const p = payload as Record<string, unknown>;
		const metadata = p.metadata as Record<string, unknown> | undefined;
		if (!metadata) return false;
		const encoding = metadata.encoding;
		if (typeof encoding === 'string') {
			return (
				encoding === 'json/plain' ||
				encoding === 'application/json'
			);
		}
		// Handle Uint8Array encoding
		if (encoding instanceof Uint8Array) {
			const decoded = new TextDecoder().decode(encoding);
			return (
				decoded === 'json/plain' || decoded === 'application/json'
			);
		}
		return false;
	}

	private decodeJsonPayload(payload: unknown): unknown {
		const p = payload as Record<string, unknown>;
		const data = p.data;
		if (data instanceof Uint8Array) {
			return JSON.parse(new TextDecoder().decode(data));
		}
		if (typeof data === 'string') {
			return JSON.parse(data);
		}
		return data;
	}

	private async decodeViaCodec(
		payload: unknown,
	): Promise<DecodedPayload> {
		if (!this.codecEndpoint) {
			return { decoded: false, reason: 'No codec endpoint' };
		}

		const blocked = codecEndpointBlockedReason(
			this.codecEndpoint,
			this.codecAllowlist,
		);
		if (blocked) {
			return { decoded: false, reason: blocked };
		}

		const response = await postToCodecEndpoint(
			this.codecEndpoint,
			{ payloads: [payload] },
			this.codecTimeoutMs,
		);

		if (!response.ok) {
			return {
				decoded: false,
				reason: `Codec returned ${response.status}`,
			};
		}

		const result = (await response.json()) as {
			payloads?: unknown[];
		};
		const decoded = result.payloads?.[0];
		if (decoded !== undefined) {
			return { decoded: true, data: decoded };
		}
		return { decoded: false, reason: 'Codec returned empty result' };
	}

	private getEncoding(payload: unknown): string {
		if (typeof payload !== 'object' || payload === null) return 'unknown';
		const metadata = (payload as Record<string, unknown>).metadata as
			| Record<string, unknown>
			| undefined;
		if (!metadata?.encoding) return 'unknown';
		if (metadata.encoding instanceof Uint8Array) {
			return new TextDecoder().decode(metadata.encoding);
		}
		return String(metadata.encoding);
	}
}
