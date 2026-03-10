import { getToolContract } from '../../../temporal/src/capability-matrix.ts';

export function requireToolContract(toolName: string) {
	const contract = getToolContract(toolName);
	if (!contract) {
		throw {
			ok: false,
			error: {
				code: 'TOOL_NOT_FOUND',
				message: `Tool "${toolName}" is not registered in the capability matrix`,
				retryable: false,
			},
		};
	}

	return contract;
}
