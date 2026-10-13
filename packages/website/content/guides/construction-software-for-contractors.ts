import type { Guide } from "./types";

export const constructionSoftwareForContractors: Guide = {
  slug: "construction-management-software-for-contractors-in-nigeria",
  title: "Construction management software for contractors in Nigeria: what you actually need",
  description:
    "A practical checklist for Nigerian and African contractors choosing construction management software: estimates and takeoffs, programme, site diary, materials, inspections, variations, payments and offline use.",
  audience: "Contractors",
  published: "2026-10-13",
  minutes: 8,
  intro: [
    "Most construction software was built for markets with reliable data, fixed prices and large head offices. A contractor in Lagos, Abuja or Accra runs jobs with patchy signal on site, material prices that move week to week, and clients who want proof before they pay. The software has to fit that, or the team goes back to WhatsApp and Excel within a month.",
    "Here is what to check, in the order a job actually runs.",
  ],
  sections: [
    {
      heading: "Estimating: from drawing to priced bill of quantities",
      paragraphs: [
        "Winning work starts with a fast, defensible estimate. Look for takeoffs measured directly from the drawings, so quantities come from the plan rather than from memory, and a bill of quantities you can price with your own rates and send as a proposal.",
        "The test: can an estimator go from a PDF drawing to a priced BoQ the client can read, without retyping anything?",
      ],
    },
    {
      heading: "Programme and look-aheads",
      paragraphs: [
        "A programme is only useful if site uses it. You want stages and activities with planned dates, a two- or three-week look-ahead the site manager actually plans from, and delays recorded with their cause on the day they happen. Those delay records are what an extension-of-time claim is built on later.",
      ],
    },
    {
      heading: "A site diary that works offline",
      paragraphs: [
        "The daily log is the most important record on a construction site and the one most often skipped. It has to be quick to fill on a phone, follow your company's own form (labour by trade, plant, deliveries, weather, visitors, incidents) and work with no signal, syncing when the phone finds one.",
        "If the app needs data to save an entry, entries will not get written on the days that matter most.",
      ],
    },
    {
      heading: "Materials: approvals, orders, deliveries and stock in one chain",
      paragraphs: [
        "Materials are where margin disappears. A good system links the whole chain: the material approval that signs off the specification, the order placed against it, the deliveries received (with the delivery note), and the stock on site going down as it is used.",
        "When those are separate spreadsheets, nobody can answer the simple questions: was this cement approved, how much did we order, how much arrived, and where did it go?",
      ],
      bullets: [
        "Crew can log a delivery from site, and a manager approves it before it counts",
        "Each delivery is matched to its order, so short deliveries show up",
        "Stock on hand is received minus used, by material, without manual reconciliation",
      ],
    },
    {
      heading: "Inspections, RFIs and variations on the record",
      paragraphs: [
        "Disputes are won with records made at the time. Inspections should end in a pass or fail report with photos; questions to the design team (RFIs) should be numbered and answered in writing; and changes to scope should be priced and approved as variations before the work is done, not argued about at the final account.",
      ],
    },
    {
      heading: "Payments that trace to verified work",
      paragraphs: [
        "Clients pay faster when they can see what they are paying for. Payment applications and certificates should reference the work completed and inspected, with retention tracked, so the conversation is about the record, not about trust.",
        "Note that good construction software records money; it should not need to hold or move it.",
      ],
    },
    {
      heading: "Roles, not just logins",
      paragraphs: [
        "The client, the quantity surveyor, the site engineer and the foreman need different views and different rights. Check that a site worker can log a delivery but not approve it, and that a client can see progress without seeing your rates.",
      ],
    },
    {
      heading: "How to evaluate in a week",
      paragraphs: [
        "Do not judge software on a demo project. Load one real job: one drawing, one stage of the programme, a week of site diaries, one delivery and one payment application. If your team can do that in a week, the system fits. If they cannot, no feature list will save it.",
        "That is exactly how we run a BuildPanda demo: on one of your own projects.",
      ],
    },
  ],
  next: { label: "Book a demo on one of your projects", href: "/talk-to-us/" },
};
