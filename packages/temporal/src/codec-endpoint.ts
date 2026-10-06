import { isIP } from 'node:net';

export const DEFAULT_CODEC_TIMEOUT_MS = 5000;

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

export function isPrivateAddress(url: string): boolean {
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

export function codecEndpointBlockedReason(
	endpoint: string,
	allowlist: readonly string[] = [],
): string | null {
	if (!isPrivateAddress(endpoint) || allowlist.includes(endpoint)) {
		return null;
	}
	return 'Codec endpoint is a private address and not in the allowlist';
}

export async function postToCodecEndpoint(
	url: string,
	body: unknown,
	timeoutMs: number = DEFAULT_CODEC_TIMEOUT_MS,
): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
}
