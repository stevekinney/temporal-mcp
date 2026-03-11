/**
 * Bridge between zod/v4 types and the MCP SDK's AnySchema type.
 *
 * The MCP SDK 1.27.1 declares AnySchema = z3.ZodTypeAny | z4.$ZodType,
 * but zod 4's classic API exports types that TypeScript can't structurally
 * match to z4.$ZodType. This helper casts the inputSchema shape so tool
 * registration compiles without losing runtime behavior.
 */
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';

export function inputSchema<T extends Record<string, unknown>>(
	shape: T,
): ZodRawShapeCompat {
	return shape as unknown as ZodRawShapeCompat;
}
