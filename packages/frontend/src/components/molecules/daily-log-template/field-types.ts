import {
  AlignLeft,
  SquareChevronDown,
  Hash,
  Heading,
  ToggleLeft,
  Type,
  type LucideIcon,
} from "lucide-react";
import type {
  TemplateFieldInput,
  TemplateFieldType,
} from "@/api/daily-log-templates";

export const FIELD_TYPE_META: Record<
  TemplateFieldType,
  { label: string; hint: string; icon: LucideIcon }
> = {
  section: { label: "Section heading", hint: "Groups the questions below it", icon: Heading },
  short_text: { label: "Short answer", hint: "One line of text", icon: Type },
  long_text: { label: "Paragraph", hint: "Several lines of text", icon: AlignLeft },
  number: { label: "Number", hint: "A count or quantity, with a unit", icon: Hash },
  select: { label: "Dropdown", hint: "Pick one from a list", icon: SquareChevronDown },
  yes_no: { label: "Yes / No", hint: "A single yes or no", icon: ToggleLeft },
};

export const FIELD_TYPE_ORDER: readonly TemplateFieldType[] = [
  "section",
  "short_text",
  "long_text",
  "number",
  "select",
  "yes_no",
];

/** A builder row. `key` is local to the editor; `id` is the server's, once saved. */
export type DraftField = TemplateFieldInput & { key: string };

let nextKey = 0;
export function draftKey(): string {
  nextKey += 1;
  return `draft-${nextKey}`;
}

export function blankField(type: TemplateFieldType): DraftField {
  return {
    key: draftKey(),
    type,
    label: "",
    helpText: null,
    required: false,
    options: type === "select" ? ["", ""] : [],
    unit: null,
  };
}

function starter(
  type: TemplateFieldType,
  label: string,
  extra: Partial<TemplateFieldInput> = {},
): DraftField {
  return { ...blankField(type), label, options: [], ...extra };
}

/**
 * The common shape of a contractor's site diary, offered as a starting point so
 * a company with its own form edits the differences rather than typing it all.
 */
export function starterFields(): DraftField[] {
  return [
    starter("section", "Site conditions"),
    starter("select", "Weather", { options: ["Sunny", "Cloudy", "Rain", "Storm", "Extreme heat"] }),
    starter("yes_no", "Work stopped by weather?"),
    starter("section", "Manpower"),
    starter("number", "Workers on site", { unit: "workers", required: true }),
    starter("long_text", "Trades and subcontractors on site"),
    starter("section", "Progress"),
    starter("long_text", "Work carried out today", { required: true }),
    starter("long_text", "Plant and equipment on site"),
    starter("long_text", "Materials delivered"),
    starter("section", "Health and safety"),
    starter("yes_no", "Any accidents or near misses?", { required: true }),
    starter("short_text", "Toolbox talk topic"),
    starter("section", "Issues"),
    starter("long_text", "Delays, instructions received or visitors"),
  ];
}

/** A short end-of-day check for a crew lead in a hurry. */
export function quickCheckFields(): DraftField[] {
  return [
    starter("select", "Weather", { options: ["Sunny", "Cloudy", "Rain", "Storm"] }),
    starter("number", "Workers on site", { unit: "workers", required: true }),
    starter("long_text", "Work done today", { required: true }),
    starter("yes_no", "Any safety incidents?", { required: true }),
    starter("long_text", "Anything holding the work up?"),
  ];
}
