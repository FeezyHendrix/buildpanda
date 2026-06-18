export interface AnnouncementScene {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  narration: string;
  accent?: string;
}

export const ANNOUNCEMENT_NARRATION_INTRO =
  "Building from anywhere shouldn't mean flying blind. So we rebuilt BuildPanda. One platform for every part of your build.";

export const ANNOUNCEMENT_SCENES: AnnouncementScene[] = [
  {
    id: "workspace",
    kicker: "One workspace",
    title: "Run the whole build from one place",
    subtitle: "Schedule, site activity, materials, finance, documents, and your team.",
    narration:
      "From one workspace you run the whole project. Open Overview and see your build's health at a glance: progress, budget, and risk, always current.",
  },
  {
    id: "schedule",
    kicker: "Schedule & progress",
    title: "An editable Gantt that keeps up",
    subtitle: "Drag to reschedule. Import a programme. Progress updates as work gets done.",
    narration:
      "Your programme lives in an editable Gantt. Drag a task and everything downstream adjusts. Mark an activity done, and progress updates automatically.",
  },
  {
    id: "assign",
    kicker: "Assign anyone to anything",
    title: "Work has owners now",
    subtitle: "Queries, RFIs, activities, change requests, even BIM issues.",
    narration:
      "Work has owners now. Assign any item, straight from the board, and they're notified instantly. So nothing falls through.",
  },
  {
    id: "rfibim",
    kicker: "RFIs + BIM in 3D",
    title: "From clash to resolution",
    subtitle: "Rich RFI responses, email replies, and IFC models in the browser.",
    narration:
      "Raise an R F I and respond with a real editor. Or open your 3D model in the browser and click any element to pin a coordination issue.",
  },
  {
    id: "messaging",
    kicker: "New — Messaging",
    title: "Mention anyone. Reference everything.",
    subtitle: "Channels, DMs, real-time. React, thread, and turn a message into a task.",
    narration:
      "And now, messaging. Channels and direct messages, in real time. Mention anyone, reference any R F I or document, and turn a message into a task in one click.",
    accent: "#004DE7",
  },
  {
    id: "portal",
    kicker: "Owner & client portal",
    title: "Invite your client with one link",
    subtitle: "A private portal, scoped to just their project.",
    narration:
      "And invite your client with one link, to a private portal scoped to just their project.",
  },
];

export const ANNOUNCEMENT_OUTRO_NARRATION =
  "BuildPanda. Build with confidence.";
