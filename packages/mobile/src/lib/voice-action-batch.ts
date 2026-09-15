import type { ProposedAction } from "@/api/voice-report-types";

export type AppliedVoiceAction = { awaitingApproval?: boolean } | void;

/** Retain completed actions when a later write fails, so retry cannot duplicate them. */
export async function applyVoiceActionBatch(
  actions: readonly { index: number; action: ProposedAction }[],
  completed: Map<number, AppliedVoiceAction>,
  apply: (action: ProposedAction) => Promise<AppliedVoiceAction>,
): Promise<void> {
  for (const { index, action } of actions) {
    if (completed.has(index)) continue;
    const result = await apply(action);
    completed.set(index, result);
  }
}
