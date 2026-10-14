import type { AccessRequirement } from "./access.ts";

export interface VoiceField {
  type: "text" | "long_text" | "rich_text" | "boolean" | "number" | "date" | "select" | "file";
  label: string;
  required?: boolean;
  choices?: readonly string[];
  source?: string;
  min?: number;
  max?: number;
  helpText?: string;
  /** Legacy records persist HTML alongside their searchable plain-text field. */
  htmlField?: string;
}
export interface VoiceDefinition {
  label: string;
  icon: string;
  instruction: string;
  permission: AccessRequirement;
  destructive?: boolean;
  online?: boolean;
  fields: Readonly<Record<string, VoiceField>>;
}
export interface VoiceOption { value: string; label: string; parentId?: string; buildingId?: string; versionId?: string; status?: string; reviewerId?: string | null; group?: string | null }
export type VoiceOptions = Readonly<Record<string, readonly VoiceOption[]>>;
export interface PickedVoiceFile { uri: string; fileName: string; mimeType: string; size: number }
export interface VoiceRichText { html: string; text: string }
export type VoiceValue = string | number | boolean | VoiceRichText | PickedVoiceFile | null;
export interface VoiceReviewField extends VoiceField { name: string; options?: readonly VoiceOption[] }

export function defineVoiceAction<const T extends VoiceDefinition>(definition: T): T { return definition; }
export const textField = (label: string, required = true) => ({ type: "text", label, required } as const);
export const longTextField = (label: string, required = true) => ({ type: "long_text", label, required } as const);
export const richTextField = (label: string, required = true) => ({ type: "rich_text", label, required } as const);
export const numberField = (label: string, min = 0) => ({ type: "number", label, required: true, min } as const);
export const dateField = (label: string, required = true) => ({ type: "date", label, required } as const);
export const targetField = (label: string, source: string, required = true) => ({ type: "select", label, source, required } as const);
export const choiceField = <const T extends readonly string[]>(label: string, choices: T, required = true) => ({ type: "select", label, choices, required } as const);
