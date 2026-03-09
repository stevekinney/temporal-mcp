import type { ToolContract } from '../contracts/tool-contract.ts';

export class ToolRegistry {
	private contracts = new Map<string, ToolContract>();

	register(contract: ToolContract): void {
		this.contracts.set(contract.name, contract);
	}

	get(name: string): ToolContract | undefined {
		return this.contracts.get(name);
	}

	has(name: string): boolean {
		return this.contracts.has(name);
	}

	getAll(): ReadonlyMap<string, ToolContract> {
		return this.contracts;
	}
}
