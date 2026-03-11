export type Risk = 'read' | 'write' | 'destructive' | 'admin';

export type ImplementationBackend =
  | 'sdk'
  | 'workflow-service'
  | 'operator-service'
  | 'cloud'
  | 'cli';

export type Availability = 'self-hosted' | 'cloud' | 'both';

export type Stability = 'stable' | 'experimental' | 'deprecated';

export interface ToolContract {
  name: string;
  risk: Risk;
  idempotent: boolean;
  supportsCancellation: boolean;
  supportsTasks: boolean;
  implementationBackend: ImplementationBackend;
  availability: Availability;
  stability: Stability;
}

export interface ToolContractExample {
  contract: ToolContract;
}

export const TOOL_CONTRACT_EXAMPLE: ToolContractExample = {
  contract: {
    name: 'temporal.workflow.describe',
    risk: 'read',
    idempotent: true,
    supportsCancellation: true,
    supportsTasks: false,
    implementationBackend: 'sdk',
    availability: 'both',
    stability: 'stable',
  },
};
