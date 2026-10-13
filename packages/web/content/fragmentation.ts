import { hero } from "./hero";

export type ToolId = "chat" | "spreadsheet" | "paper" | "email" | "payments" | "tools";

export const fragmentation = {
  eyebrow: hero.eyebrow,
  headline: ["Construction isn’t fragmented", "Your software is"],
  body: "Every build already follows one continuous chain of decisions. BuildPanda models that chain end to end, so information entered once at enquiry is still working for you at handover.",
  broken: {
    label: "The current way",
    title: "The broken way",
    description:
      "Six places to look, none of which agree with each other, and no single answer to “where is this project actually at?”",
    listLabel: "Where project information lives today",
    tools: [
      { id: "chat", label: "WhatsApp groups" },
      { id: "spreadsheet", label: "Excel spreadsheets" },
      { id: "paper", label: "Paper site records" },
      { id: "email", label: "Drawings by email" },
      { id: "payments", label: "Payment records" },
      { id: "tools", label: "Disconnected tools" },
    ] satisfies ReadonlyArray<{ id: ToolId; label: string }>,
  },
  platform: {
    label: "The best way",
    title: "One platform, the whole build!",
    // PLACEHOLDER: the design repeats the broken-way description here. Needs real copy.
    description:
      "Six places to look, none of which agree with each other, and no single answer to “where is this project actually at?”",
    listLabel: "One platform, every stage",
  },
} as const;
