import type { ExtendedAction, ExtendedActionKind, VoiceOptions } from '@buildpanda/voice-actions';
import type { Db } from '@/db/client';
import type { AccessState } from '@/lib/project-access-store';

export interface VoiceExecutionContext {
  db: Db;
  projectId: string;
  userId: string;
  authorName: string;
  online: boolean;
  ticket: AccessState;
  options: VoiceOptions;
}
export interface VoiceExecutionResult {
  notice?: string;
  queued?: boolean;
  awaitingApproval?: boolean;
  document?: { id: string; name: string };
}
export type VoiceHandlerMap = { [K in ExtendedActionKind]:
  (payload: Extract<ExtendedAction, { kind: K }>['payload'], context: VoiceExecutionContext) => Promise<VoiceExecutionResult>;
};
export function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined || value === '') throw new Error('Complete the action details before applying.');
  return value;
}
export function option(context: VoiceExecutionContext, source: string, id: string | null) {
  return required(context.options[source]?.find((row) => row.value === id));
}
/** Omitted edits must leave the existing record intact. */
export function changes<T extends object>(payload: T): { [K in keyof T]?: NonNullable<T[K]> } {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== null && value !== undefined)) as { [K in keyof T]?: NonNullable<T[K]> };
}
