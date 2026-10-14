import type { VoiceExecutionResult } from './types';

/** A cache failure after a committed request must never invite a duplicate write. */
export async function remoteResult(updateCache: () => Promise<void>): Promise<VoiceExecutionResult> {
  try { await updateCache(); return { queued: false }; }
  catch { return { queued: false, notice: 'Applied online. Reopen the project to refresh this device’s copy.' }; }
}
