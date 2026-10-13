export type FaqItem = { id: string; question: string; answer: string };

export const faq = {
  eyebrow: "FAQ",
  title: "Frequently Asked Questions",
  intro: "What contractors and owners ask before they run a build on BuildPanda. Type your own question and, if it isn't here, send it to the team.",
  search: {
    label: "Search the questions",
    placeholder: "Ask us anything",
    submit: "Go to the first matching question",
    empty: "No question matches that yet.",
  },
} as const;

/** Same questions and answers as the current site (packages/web/lib/faq.ts). */
export const faqItems: ReadonlyArray<FaqItem> = [
  {
    id: "cost",
    question: "What does it cost?",
    answer:
      "We are early, so there is no published price list: tell us about the job on the demo call and we will give you the number. Pricing is per project and scales with contract value, so a small job costs less than a large one. Inspections are quoted per visit. No implementation fee while we are early.",
  },
  {
    id: "software-or-build",
    question: "Do you sell software, or do you build?",
    answer:
      "Both, and they are separate. Most people come for the software and run their own jobs on it. Some ask us to run the build instead, and then we scope it, appoint the trades and manage the site, reporting to you as we go. You are never signed up to one by buying the other.",
  },
  {
    id: "who-inspects",
    question: "If you build it, who inspects it?",
    answer:
      "Not the people building it. An inspection is a job BuildPanda is asked to do: one side of the contract requests it, BuildPanda assigns the inspector, and the inspector attends and issues the report with a pass or a fail and the findings behind it. The contractor being inspected can read that report and cannot change it — and that holds when the contractor is us.",
  },
  {
    id: "hold-money",
    question: "Do you hold the money?",
    answer:
      "No. We are not a bank and not an escrow agent, and we do not hold or transfer funds. We record what was certified, what was paid and what it was paid against. The money moves through your own bank.",
  },
  {
    id: "bad-signal",
    question: "Does it work on a phone with bad signal?",
    answer:
      "The site app holds the day's work on the device and sends it when the signal comes back. Nothing is lost in the meantime.",
  },
  {
    id: "bill-of-quantities",
    question: "Can it read our bill of quantities?",
    answer:
      "Bring it in and price against it. Send us a sample and tell us the standard it is written in before you start, and we will confirm what we can read today rather than find out on your first job.",
  },
  {
    id: "primavera",
    question: "We already use Primavera. Do we throw it away?",
    answer:
      "No. Keep the programme where it is and bring the dates in. Send us a sample of your export and we will tell you what comes through.",
  },
  {
    id: "disappear",
    question: "You are new. What happens if you disappear?",
    answer:
      "Ask for an export before you sign up and we will show you what comes out. Transactions come out as a spreadsheet file and the programme as a file your planning tool can open. Ask us about anything else and we will tell you straight what we can hand over today.",
  },
];
