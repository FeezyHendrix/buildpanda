export interface FaqItem {
  q: string;
  a: string;
}

// Money first, and no pricing table anywhere on the site. These answers are
// rendered as the homepage accordion and emitted as FAQPage structured data,
// so a question only earns a place here if a real buyer asks it.
export const faqItems: FaqItem[] = [
  {
    q: "What does it cost?",
    a: "We are early, so there is no published price list: tell us about the job on the demo call and we will give you the number. Pricing is per project and scales with contract value, so a small job costs less than a large one. Inspections are quoted per visit. No implementation fee while we are early.",
  },
  {
    q: "Do you sell software, or do you build?",
    a: "Both, and they are separate. Most people come for the software and run their own jobs on it. Some ask us to run the build instead, and then we scope it, appoint the trades and manage the site, reporting to you as we go. You are never signed up to one by buying the other.",
  },
  {
    // DECISION NEEDED: see the comment on components/home/verification.tsx.
    // This answer describes the mechanism and claims no independence until the
    // founder has written down how the inspection arm is separated from the
    // build team.
    q: "If you build it, who inspects it?",
    a: "Not the people building it. An inspection is a job BuildPanda is asked to do: one side of the contract requests it, BuildPanda assigns the inspector, and the inspector attends and issues the report with a pass or a fail and the findings behind it. The contractor being inspected can read that report and cannot change it — and that holds when the contractor is us.",
  },
  {
    q: "Do you hold the money?",
    a: "No. We are not a bank and not an escrow agent, and we do not hold or transfer funds. We record what was certified, what was paid and what it was paid against. The money moves through your own bank.",
  },
  {
    q: "Does it work on a phone with bad signal?",
    a: "The site app holds the day's work on the device and sends it when the signal comes back. Nothing is lost in the meantime.",
  },
  {
    q: "Can it read our bill of quantities?",
    a: "Bring it in and price against it. Send us a sample and tell us the standard it is written in before you start, and we will confirm what we can read today rather than find out on your first job.",
  },
  {
    q: "We already use Primavera. Do we throw it away?",
    a: "No. Keep the programme where it is and bring the dates in. Send us a sample of your export and we will tell you what comes through.",
  },
  {
    q: "You are new. What happens if you disappear?",
    a: "Ask for an export before you sign up and we will show you what comes out. Transactions come out as a spreadsheet file and the programme as a file your planning tool can open. Ask us about anything else and we will tell you straight what we can hand over today.",
  },
];
