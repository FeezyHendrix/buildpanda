import type { Guide } from "./types";

export const materialTracking: Guide = {
  slug: "construction-material-tracking-stop-losses-on-site",
  title: "Construction material tracking: how to stop materials going missing on site",
  description:
    "How contractors can track construction materials from approval to delivery to use: delivery notes, matching deliveries to orders, approving receipts and keeping stock on hand honest.",
  audience: "Site teams",
  published: "2026-10-13",
  minutes: 7,
  intro: [
    "Ask a site manager how many bags of cement are on site and you will usually get an estimate. Ask how many were delivered against last week's order and you will often get a shrug. Materials are a large share of any building's cost, and the gap between what was paid for and what was used is where projects quietly lose money.",
    "The fix is not more checking. It is a chain of simple records where each one points at the one before it.",
  ],
  sections: [
    {
      heading: "1. Approve the material before you order it",
      paragraphs: [
        "A material approval (often called a submittal) records that the specification was accepted: the grade of cement, the size of rod, the brand of tile. Ordering before it is approved is how the wrong material ends up built in and has to be broken out.",
        "Keep the approval and its decision on the record, so an order can be checked against what was signed off.",
      ],
    },
    {
      heading: "2. Order against the approval",
      paragraphs: [
        "Each order should name the material, the quantity, the unit and the date it is needed on site, and point back to the approval it relies on. If the approval was rejected and resubmitted, the order should follow the new one.",
      ],
    },
    {
      heading: "3. Record every delivery against its order",
      paragraphs: [
        "When a lorry arrives, record what was received, how much, the delivery note number, and which order it was for. Count before you sign. A delivery recorded against its order is what tells you an order of 400 bags is only 250 delivered.",
        "Deliveries nobody ordered are not always wrong (local top-ups happen), but they should be visible as unplanned so someone asks why.",
      ],
      bullets: [
        "Count and inspect before signing the delivery note",
        "Photograph the delivery note and the load",
        "Reject a short or damaged load on the record, with the reason",
      ],
    },
    {
      heading: "4. Separate logging from approving",
      paragraphs: [
        "The person who receives goods on site should be able to log them immediately, even with no signal. A manager should then accept the entry before it counts in stock. That small step catches double entries and typing mistakes before they reach the numbers everyone trusts.",
      ],
    },
    {
      heading: "5. Keep one name and one unit per material",
      paragraphs: [
        "\"Cement\", \"cement bags\" and \"bags of Portland cement\" are the same material, but in a spreadsheet they become three lines, and one of them shows negative stock. Agree one name and one unit per material, or use a system that recognises the variations, so received minus used always adds up.",
      ],
    },
    {
      heading: "6. Log usage against the work",
      paragraphs: [
        "Stock only goes down when material is used, and usage is most useful when it is tied to the stage or activity it went into. Over a job that tells you which stages ran over their material allowance, which is how you price the next job better.",
      ],
    },
    {
      heading: "What good looks like",
      paragraphs: [
        "At any moment you can answer: what was approved, what was ordered, what arrived, what was used, and what should be on site now. BuildPanda links those records automatically, on the web and on the offline mobile app the site team uses.",
      ],
    },
  ],
  next: { label: "See BuildPanda on one of your projects", href: "/talk-to-us/" },
};
