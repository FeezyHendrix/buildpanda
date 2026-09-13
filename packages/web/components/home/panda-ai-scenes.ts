export interface Scene {
  /** The capability, as a person would name it. */
  label: string;
  /** What someone types, in their words. */
  ask: string;
  /** What comes back. Each line is one row in the answer panel. */
  answer: string[];
  /** The tool or engine behind it, shown as a small footnote on the panel. */
  source: string;
}

/**
 * Every scene maps to something the product actually does: the first to the
 * pre-construction take-off, the rest to read tools the assistant has
 * (get_delays, get_schedule_position, get_finances, get_daily_logs,
 * analyze_drawing) and to the only two things it may write — an RFI and a task.
 * Nothing here is a capability we hope to add.
 */
export const scenes: Scene[] = [
  {
    label: "Take off a drawing",
    ask: "Take off the quantities on this drawing and price them.",
    answer: [
      "Measured 14 items off sheet P-03 at 1:120.",
      "Priced against your rate library — ₦42,500,000.",
      "Every line is editable before it reaches a proposal.",
    ],
    source: "Pre-construction take-off",
  },
  {
    label: "Ask about the programme",
    ask: "Why are we four days late?",
    answer: [
      "Two delays on the critical chain: rain (1 day) and a client access hold (2 days).",
      "Sub-base to ch 1+200 moved, and everything after it moved with it.",
      "Completion is now 01 Apr 2027, against 26 Mar in the contract.",
    ],
    source: "Reads the programme and the delay register",
  },
  {
    label: "Ask about the money",
    ask: "How much have we certified, and what is still unpaid?",
    answer: [
      "Certified gross to date ₦20,187,500 on an adjusted sum of ₦854,200,000.",
      "Nothing received against it, so ₦20,187,500 is unpaid certified.",
      "Retention held ₦1,009,375.",
    ],
    source: "Reads the certificates and recorded receipts",
  },
  {
    label: "Ask about the site",
    ask: "Summarise last week on site.",
    answer: [
      "Seven days logged, 489 hours, average crew 8.1 of 14.",
      "Two rain days with no hours booked.",
      "Hours went on sub-base, culvert 1 and the side drain.",
    ],
    source: "Reads the site diary day by day",
  },
  {
    label: "Read a document",
    ask: "What is on sheet P-03?",
    answer: [
      "A roof plan, 30350 by 14300, aluminium sheets on hardwood purlins.",
      "It reads PDFs, spreadsheets and Word files the same way.",
    ],
    source: "Opens the drawing and describes it",
  },
  {
    label: "Act on it",
    ask: "Raise an RFI about the culvert invert level.",
    answer: [
      "RFI-7 raised against drawing IS2-RD-104 Rev B, attributed to you.",
      "A task opened alongside it, due in five working days.",
      "Raising an RFI and opening a task are the only two things it changes.",
    ],
    source: "Writes to the record, with your name on it",
  },
];
