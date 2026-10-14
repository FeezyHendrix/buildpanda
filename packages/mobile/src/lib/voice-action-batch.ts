import type { ProposedAction } from "@/api/voice-report-types";

import type { VoiceExecutionResult } from "./voice/types";

export type AppliedVoiceAction = VoiceExecutionResult | void;

/** Retain completed actions when a later write fails, so retry cannot duplicate them. */
export async function applyVoiceActionBatch(
  actions: readonly { index: number; action: ProposedAction }[],
  completed: Map<number, AppliedVoiceAction>,
  apply: (action: ProposedAction) => Promise<AppliedVoiceAction>,
): Promise<void> {
  const failures: string[] = [];
  for (const { index, action } of actions) {
    if (completed.has(index)) continue;
    try {
      completed.set(index, await apply(action));
    } catch (error) {
      // Deliberate: one record the crew cannot save used to abandon every
      // action after it, so a report of eight saved three and dropped the rest
      // however often it was retried. Attempt all, name only what failed.
      failures.push(
        `${action.title}: ${error instanceof Error ? error.message : "could not be saved"}`,
      );
    }
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));
}
