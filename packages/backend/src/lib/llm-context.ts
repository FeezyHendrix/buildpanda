import { AsyncLocalStorage } from "node:async_hooks";

export interface LlmContext {
  orgId?: string;
  userId?: string;
  jobId?: string;
  source: "request" | "job" | "system";
}

const store = new AsyncLocalStorage<LlmContext>();

export function runWithLlmContext<T>(
  ctx: LlmContext,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return store.run(ctx, fn);
}

export function enterLlmContext(ctx: LlmContext): void {
  store.enterWith(ctx);
}

export function getLlmContext(): LlmContext | undefined {
  return store.getStore();
}
