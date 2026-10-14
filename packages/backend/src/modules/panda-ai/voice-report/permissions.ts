import { captureAccess, voiceRequirement, permits } from '@buildpanda/voice-actions';
import type { DraftAction } from './types.ts';
type Can = (resource: string, action: string) => boolean;
export function canCapture(can: Can, capabilities: Readonly<Record<string, boolean>> = {}, workspaceCan?: Can): boolean {
  return permits(captureAccess, can, capabilities, workspaceCan);
}
export function canPropose(action: DraftAction, can: Can, capabilities: Readonly<Record<string, boolean>> = {}, workspaceCan?: Can): boolean {
  return permits(voiceRequirement(action), can, capabilities, workspaceCan);
}
