import { actionDefinition, isExtendedAction, validateExtendedAction, voiceRequirement, type ExtendedAction } from '@buildpanda/voice-actions';
import type { ProposedAction } from '@/api/voice-report-types';
import { requireAccess, requireCurrentAccess } from '@/lib/project-access-store';
import { fieldHandlers } from './field-handlers';
import { communicationHandlers } from './communication-handlers';
import { documentHandlers } from './document-handlers';
import type { VoiceExecutionContext, VoiceHandlerMap } from './types';

/** Adding a catalog kind without its executor is a compile-time error. */
export const voiceHandlers = { ...fieldHandlers, ...communicationHandlers, ...documentHandlers } satisfies VoiceHandlerMap;
export function isExtendedProposal(action: ProposedAction): action is ExtendedAction & Pick<ProposedAction, 'missing' | 'reviewOptions'> {
  return isExtendedAction(action.kind);
}
export async function executeVoiceAction(action: ExtendedAction, context: VoiceExecutionContext) {
  requireCurrentAccess(context.ticket);
  requireAccess(context.projectId, voiceRequirement(action));
  const errors = validateExtendedAction(action, context.options);
  if (errors.length) throw new Error(errors.join(' '));
  if (actionDefinition(action.kind).online && !context.online) throw new Error('Connect to apply this action.');
  // The registry and payload share the discriminant; TS loses that correlation
  // at a computed lookup. Every individual handler retains its exact payload.
  const handler = voiceHandlers[action.kind] as (payload: ExtendedAction['payload'], c: VoiceExecutionContext) => ReturnType<VoiceHandlerMap[ExtendedAction['kind']]>;
  return handler(action.payload, context);
}
