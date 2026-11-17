import type { FieldToolContext } from "./tool-types.ts";
export type FieldReadRunner = (context: FieldToolContext, args: Record<string, unknown>) => Promise<unknown>;
