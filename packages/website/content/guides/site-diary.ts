import type { Guide } from "./types";

export const siteDiary: Guide = {
  slug: "how-to-write-a-construction-site-diary",
  title: "How to write a construction site diary that holds up in a dispute",
  description:
    "What to record in a construction site diary (daily log) every day, with a ready-to-use template: labour, plant, deliveries, weather, progress, delays, instructions, visitors and incidents.",
  audience: "Site teams",
  published: "2026-10-13",
  minutes: 6,
  intro: [
    "When a project ends in an argument about delay, extra cost or who instructed what, the site diary is usually the first document anyone asks for. A diary written every day, by the person on site, at the time, is hard to argue with. One reconstructed afterwards is easy to.",
    "Here is what to record, and how to make it a habit rather than a chore.",
  ],
  sections: [
    {
      heading: "What to record every day",
      paragraphs: [
        "Keep the same structure every day so entries can be compared and nothing is forgotten.",
      ],
      bullets: [
        "Date, weather in the morning and afternoon, and any hours lost to it",
        "Labour on site by trade, including subcontractors",
        "Plant and equipment on site, and whether it was working",
        "Deliveries received, with delivery note numbers",
        "Work done, by area or stage, in plain words",
        "Delays and their causes: late information, access, weather, materials",
        "Instructions received, from whom, and whether they were written",
        "Visitors and inspections, with names and organisations",
        "Accidents, near misses and safety observations",
      ],
    },
    {
      heading: "Write it the same day",
      paragraphs: [
        "A diary's value comes from being contemporaneous: made at the time. Write it before leaving site. If the phone has no signal, it should still save and sync later; an entry typed into a notebook at night and copied in next week is weaker evidence.",
      ],
    },
    {
      heading: "Facts, not opinions",
      paragraphs: [
        "Write what happened, not what you think about it. \"Concrete pour for ground floor slab postponed: drawings for column C4 not yet received (RFI-012 raised 3 days ago)\" is useful. \"Architect slow again\" is not.",
      ],
    },
    {
      heading: "Photos with context",
      paragraphs: [
        "A photo is only evidence if someone can tell where and when it was taken and what it shows. Attach photos to the day's entry with one line explaining each, especially before work is covered up.",
      ],
    },
    {
      heading: "Never rewrite yesterday",
      paragraphs: [
        "If an entry is wrong, add a correction rather than editing the original. A record that can be changed silently is a record a court or arbitrator will not trust. Good software keeps the original and shows the correction beside it.",
      ],
    },
    {
      heading: "Use your company's form",
      paragraphs: [
        "Every contractor has their own way of reporting the day. A diary app should let you build your own form once (the sections above, plus whatever your clients ask for) so the site team fills the same questions every day in a minute or two.",
        "In BuildPanda the office builds the form, and the site team fills it on their phone, online or offline.",
      ],
    },
  ],
  next: { label: "Book a demo", href: "/talk-to-us/" },
};
