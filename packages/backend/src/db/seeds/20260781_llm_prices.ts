import type { Knex } from "knex";
import { LLM_PRICES } from "../../lib/llm-pricing.ts";

export async function seed(knex: Knex): Promise<void> {
  for (const price of LLM_PRICES) {
    await knex("llm_prices")
      .insert({
        model_version: price.modelVersion,
        input_per_1k: price.inputPer1k,
        output_per_1k: price.outputPer1k,
        effective_from: price.effectiveFrom,
      })
      .onConflict(["model_version", "effective_from"])
      .merge(["input_per_1k", "output_per_1k"]);
  }
}
