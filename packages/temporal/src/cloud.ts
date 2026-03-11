import type { ErrorEnvelope } from '../../server/src/contracts/error-envelope.ts';

function cloudUnavailable(operation: string): ErrorEnvelope {
	return {
		ok: false,
		error: {
			code: 'CLOUD_API_UNAVAILABLE',
			message: `Cloud API operation "${operation}" is not yet implemented. This will be available in a future release.`,
			retryable: false,
		},
	};
}

export function listCloudNamespaces(): ErrorEnvelope {
	return cloudUnavailable('listCloudNamespaces');
}

export function describeCloudNamespace(): ErrorEnvelope {
	return cloudUnavailable('describeCloudNamespace');
}

export function getCloudAccountInfo(): ErrorEnvelope {
	return cloudUnavailable('getCloudAccountInfo');
}
