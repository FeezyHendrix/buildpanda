import { allOf, anyOf, DENY } from './access.ts';
import { features } from './features.ts';
import { legacyActions } from './legacy-actions.ts';
import { fieldActions } from './field-actions.ts';
import { communicationActions } from './communication-actions.ts';
import { documentActions } from './document-actions.ts';
import type { PickedVoiceFile, VoiceDefinition, VoiceField, VoiceRichText } from './types.ts';
export * from './types.ts';
export { permits } from './access.ts';
export const extendedActions = { ...fieldActions, ...communicationActions, ...documentActions } as const;
export const voiceActions = { ...legacyActions, ...extendedActions } as const;
export type VoiceActionKind = keyof typeof voiceActions;
export type ExtendedActionKind = keyof typeof extendedActions;
type Value<F extends VoiceField> = F['type'] extends 'number' ? number : F['type'] extends 'boolean' ? boolean : F['type'] extends 'rich_text' ? VoiceRichText : F['type'] extends 'file' ? PickedVoiceFile : F extends { choices: readonly (infer C)[] } ? C : string;
export type ExtendedAction = { [K in ExtendedActionKind]: { kind: K; title: string; summary: string;
  payload: { [P in keyof typeof extendedActions[K]['fields']]: (typeof extendedActions[K]['fields'][P] extends VoiceField ? Value<typeof extendedActions[K]['fields'][P]> : never) | null };
} }[ExtendedActionKind];
export function isExtendedAction(kind: string): kind is ExtendedActionKind { return Object.hasOwn(extendedActions, kind); }
export function voiceRequirement(action: { kind: string; payload: object }) {
  if (!Object.hasOwn(voiceActions, action.kind)) return DENY;
  const payload = action.payload as Record<string, unknown>;
  if (action.kind === 'material_log' && payload.entryType === 'USED') return features.materialLog.actions.usage;
  const status = (payload.patch as Record<string, unknown> | undefined)?.status;
  if (action.kind === 'update_material_order' && typeof status === 'string' && ['Approved', 'Ordered', 'PartiallyDelivered', 'Delivered', 'Rejected'].includes(status)) return features.materialOrders.actions.approve;
  if (action.kind === 'log_activity' && payload.delayReasonCode) return allOf(legacyActions.log_activity.permission, features.schedule.actions.edit);
  return voiceActions[action.kind as VoiceActionKind].permission;
}
export const captureAccess = allOf(features.project.read, anyOf(...Object.values(voiceActions).map((action) => action.permission)));
export const actionDefinition = (kind: VoiceActionKind): VoiceDefinition => voiceActions[kind];
