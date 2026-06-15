export interface AnnouncementScene {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  narration: string;
  accent?: string;
}

export const ANNOUNCEMENT_NARRATION_INTRO =
  "Building in Nigeria, or building from abroad, shouldn't mean flying blind. So we rebuilt BuildPanda from the ground up. One platform, every part of your build, in real time.";

export const ANNOUNCEMENT_SCENES: AnnouncementScene[] = [
  {
    id: "workspace",
    kicker: "One workspace",
    title: "Run the whole build from one place",
    subtitle: "Schedule, site activity, materials, finance, documents, and your team.",
    narration:
      "From one workspace you run the whole project: schedule, site activity, materials, finance, documents, and your team. Open Overview and you see the health of your build at a glance, progress, budget, and risk, always current.",
  },
  {
    id: "schedule",
    kicker: "Schedule & progress",
    title: "An editable Gantt that keeps up",
    subtitle: "Drag to reschedule. Import a programme. Progress updates as work gets done.",
    narration:
      "Your programme of work lives in an editable Gantt. Drag a task to reschedule it, and everything downstream adjusts. Import a programme and BuildPanda parses your phases, activities, and key dates straight in. Mark a site activity done, and progress updates automatically.",
  },
  {
    id: "assign",
    kicker: "Assign anyone to anything",
    title: "Work has owners now",
    subtitle: "Queries, RFIs, activities, change requests, even BIM issues.",
    narration:
      "Work has owners now. Every item, queries, RFIs, site activities, change requests, even BIM issues, can be assigned to a person, straight from the kanban board. They get notified instantly. That's why we built the board, so nothing falls through.",
  },
  {
    id: "rfibim",
    kicker: "RFIs + BIM in 3D",
    title: "From clash to resolution",
    subtitle: "Rich RFI responses, email replies, and IFC models in the browser.",
    narration:
      "Raise an R F I, route it to the right person, and respond with a proper editor, attach images, reference any activity or document, even reply by email. Coordinating in 3D? Upload your I F C model, open it in the browser, and click any element to pin a coordination issue.",
  },
  {
    id: "messaging",
    kicker: "New — Messaging",
    title: "Mention anyone. Reference everything.",
    subtitle: "Channels, DMs, real-time. React, thread, and turn a message into a task.",
    narration:
      "And now, BuildPanda has messaging. Channels and direct messages for everyone on the build. Mention anyone, and reference anything in the system, an R F I, an activity, a document, right inside the conversation. It's real time. React, reply in threads, pin what matters, and attach files from the field. See something that needs doing? Turn any message into an action item in one click.",
    accent: "#004DE7",
  },
  {
    id: "portal",
    kicker: "Owner & client portal",
    title: "Invite your client with one link",
    subtitle: "A private portal, scoped to just their project.",
    narration:
      "Invite your client or homeowner with one link. They get their own portal, scoped to just their project, so they can follow the build from anywhere in the world.",
  },
];

export const ANNOUNCEMENT_OUTRO_NARRATION =
  "Your whole portfolio. What's next, everywhere. One command center for the people who build. BuildPanda. Build with confidence.";
