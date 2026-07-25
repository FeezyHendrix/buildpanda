import type { Knex } from "knex";
import { generateId } from "../../lib/ids.ts";
import type { LlmCallRecord } from "../../lib/llm.ts";

export interface LlmCallRow {
  id: string;
  prompt_id: string | null;
  prompt_version: string | null;
  model_version: string | null;
  seed: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  validation_status: string;
  retry_count: number;
  org_id: string | null;
  created_at: Date | string;
}

export function llmCallsRepository(db: Knex) {
  return {
    insert: (record: LlmCallRecord): Promise<void> =>
      db("llm_calls")
        .insert({
          id: generateId("llm"),
          prompt_id: record.promptId ?? null,
          prompt_version: record.promptVersion ?? null,
          model_version: record.modelVersion,
          seed: record.seed ?? null,
          tokens_in: record.tokensIn ?? null,
          tokens_out: record.tokensOut ?? null,
          latency_ms: record.latencyMs,
          validation_status: record.validationStatus,
          retry_count: record.retryCount,
          org_id: record.orgId ?? null,
        })
        .then(() => undefined),

    latest: (): Promise<LlmCallRow | undefined> =>
      db<LlmCallRow>("llm_calls").orderBy("created_at", "desc").first(),
  };
}
