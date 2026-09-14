export interface LlmPrice {
  modelVersion: string;
  inputPer1k: number;
  outputPer1k: number;
  effectiveFrom: string;
}

/**
 * Source-of-truth USD price list, mirrored into the `llm_prices` table by the
 * seed so cost can be joined in SQL. Prices are per 1,000 tokens. Add a new row
 * (never edit an existing one) when a provider changes pricing, and set the
 * previous row's `effective_to` in the same seed run so historical costs stay
 * accurate.
 */
export const LLM_PRICES: readonly LlmPrice[] = [
  {
    modelVersion: "gpt-4o-mini",
    inputPer1k: 0.00015,
    outputPer1k: 0.0006,
    effectiveFrom: "2024-07-18",
  },
  {
    modelVersion: "gpt-4o-2024-08-06",
    inputPer1k: 0.0025,
    outputPer1k: 0.01,
    effectiveFrom: "2024-08-06",
  },
  {
    modelVersion: "kimi-k2-0905-preview",
    inputPer1k: 0.0006,
    outputPer1k: 0.0025,
    effectiveFrom: "2025-09-05",
  },
  // DeepSeek V4.1 Flash (vision). Peak-hour list price; off-peak (outside
  // 01:00-04:00 and 06:00-10:00 UTC, Mon-Fri) is half, so this is an upper bound.
  {
    modelVersion: "deepseek-flash",
    inputPer1k: 0.0003,
    outputPer1k: 0.0012,
    effectiveFrom: "2026-09-11",
  },
] as const;
