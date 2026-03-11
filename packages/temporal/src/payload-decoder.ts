import { isIP } from 'node:net';

export interface DecodedPayload {
	decoded: boolean;
	data?: unknown;
	encoding?: string;
	reason?: string;
}

const PRIVATE_IPV4_RANGES = [
	/^10\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	/^127\./,
	/^0\./,
	/^169\.254\./,
];

const PRIVATE_IPV6_RANGES = [
	/^::1$/i,
	/^fc[0-9a-f]{2}:/i,
	/^fd[0-9a-f]{2}:/i,
	/^fe80:/i,
];

const PRIVATE_HOSTNAMES = [
	/^localhost$/i,
];

function stripIPv6Brackets(hostname: string): string {
	if (hostname.startsWith('[') && hostname.endsWith(']')) {
		return hostname.slice(1, -1);
	}
	return hostname;
}

function decodeIPv6MappedIPv4(ipv6: string): string | null {
	const mappedPrefix = '::ffff:';
	if (!ipv6.toLowerCase().startsWith(mappedPrefix)) {
		return null;
	}

	const mappedPart = ipv6.slice(mappedPrefix.length);
	if (mappedPart.includes('.')) {
		return mappedPart;
	}

	const match = mappedPart.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
	if (!match) {
		return null;
	}

	const left = Number.parseInt(match[1]!, 16);
	const right = Number.parseInt(match[2]!, 16);
	const octets = [
		(left >> 8) & 0xff,
		left & 0xff,
		(right >> 8) & 0xff,
		right & 0xff,
	];
	return octets.join('.');
}

function isPrivateAddress(url: string): boolean {
	try {
		const parsed = new URL(url);
		const hostname = stripIPv6Brackets(parsed.hostname);
		if (PRIVATE_HOSTNAMES.some((pattern) => pattern.test(hostname))) {
			return true;
		}

		const ipVersion = isIP(hostname);
		if (ipVersion === 4) {
			return PRIVATE_IPV4_RANGES.some((pattern) =>
				pattern.test(hostname),
			);
		}
		if (ipVersion === 6) {
			const mappedIPv4 = decodeIPv6MappedIPv4(hostname);
			if (mappedIPv4) {
				return PRIVATE_IPV4_RANGES.some((pattern) =>
					pattern.test(mappedIPv4),
				);
			}
			return PRIVATE_IPV6_RANGES.some((pattern) =>
				pattern.test(hostname),
			);
		}

		return false;
	} catch {
		return true; // Treat unparseable URLs as private
	}
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
		this.codecTimeoutMs = options?.codecTimeoutMs ?? 5000;
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

		// SSRF protection
		if (
			isPrivateAddress(this.codecEndpoint) &&
			!this.codecAllowlist.includes(this.codecEndpoint)
		) {
			return {
				decoded: false,
				reason: 'Codec endpoint is a private address and not in the allowlist',
			};
		}

		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			this.codecTimeoutMs,
		);

		try {
			const response = await fetch(this.codecEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ payloads: [payload] }),
				signal: controller.signal,
			});

			if (!response.ok) {
				return {
					decoded: false,
					reason: `Codec returned ${response.status}`,
				};
			}

			const result = await response.json();
			const decoded = (result as any).payloads?.[0];
			if (decoded !== undefined) {
				return { decoded: true, data: decoded };
			}
			return { decoded: false, reason: 'Codec returned empty result' };
		} finally {
			clearTimeout(timeout);
		}
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
