import type { ErrorEnvelope } from '../contracts/error-envelope.ts';

export function errorResponse(error: unknown) {
	let envelope: ErrorEnvelope;
	if (isErrorEnvelope(error)) {
		envelope = error;
	} else {
		const message =
			error instanceof Error ? error.message : 'An unknown error occurred';
		envelope = {
			ok: false,
			error: { code: 'INTERNAL_ERROR', message, retryable: false },
		};
	}
	return {
		content: [{ type: 'text' as const, text: JSON.stringify(envelope) }],
		isError: true,
	};
}

export function successResponse(data: unknown) {
	return {
		content: [
			{
				type: 'text' as const,
				text: JSON.stringify({ ok: true, data }, null, 2),
			},
		],
	};
}

export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
	return (
		typeof value === 'object' &&
		value !== null &&
		'ok' in value &&
		(value as ErrorEnvelope).ok === false &&
		'error' in value
	);
}
