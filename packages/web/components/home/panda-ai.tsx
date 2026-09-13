import Image from "next/image";
import { Container, SectionHeading } from "@/components/ui";

/**
 * Every question below maps to a read tool the assistant actually has
 * (get_delays, get_schedule_position, get_payment_claims, get_daily_logs,
 * get_material_stock, analyze_drawing and the rest). Nothing here claims a
 * capability the agent cannot serve, and the two write actions are the only
 * two it has: raise an RFI, open a task.
 */
const asks = [
  {
    q: "Why are we four days late?",
    a: "It reads the programme and the delay register, and answers with the activities that moved, the days lost against each, and who was recorded as responsible.",
  },
  {
    q: "Summarise the site diary for last week.",
    a: "Day by day: weather, crew against crew expected, hours, and which activities those hours went on. Days dated ahead of today are reported separately as a plan, never folded into the totals.",
  },
  {
    q: "What is on this drawing?",
    a: "It opens the sheet and describes it, and reads a PDF, a spreadsheet or a Word document the same way.",
  },
  {
    q: "How much have we certified, and what is still unpaid?",
    a: "Contract sum, variations, certified to date, retention held, advance recovery and the payment claims behind them.",
  },
  {
    q: "Which materials are short, and which orders are late?",
    a: "Stock against what the programme needs, purchase orders past their promised date, and the suppliers they sit with.",
  },
  {
    q: "Raise an RFI about the culvert invert level.",
    a: "It writes the RFI and opens the task, attributed to you, on the record. Those two are the only things it changes.",
  },
];

export function PandaAi() {
  return (
    <section className="bg-surface-muted py-24 sm:py-32 2xl:py-40">
      <Container className="flex flex-col gap-14 2xl:gap-20">
        <SectionHeading
          eyebrow="Panda AI"
          title="Ask the project a question."
          description="It answers from the project's own record, not from the internet and not from a summary somebody typed. If the record does not hold the answer, it says so."
        />

        <Image
          src="/product/panda-ai.jpg"
          alt="Panda AI open on a road project: a health score, a written summary of where the project stands, a health trend, and progress, budget variance and outstanding invoiced beneath"
          width={2055}
          height={750}
          sizes="(max-width: 1400px) 100vw, 1600px"
          className="w-full rounded-xl border border-line bg-white shadow-[0_24px_60px_-30px_rgba(13,19,33,0.35)]"
        />

        <div className="grid border-t border-hairline sm:grid-cols-2 lg:grid-cols-3">
          {asks.map((ask) => (
            <div
              key={ask.q}
              className="flex flex-col gap-3 border-b border-hairline py-8 pr-8 sm:pl-8 sm:[&:nth-child(odd)]:pl-0 lg:pl-8 lg:[&:nth-child(3n+1)]:pl-0 lg:[&:nth-child(odd)]:pl-8 lg:[&:nth-child(4)]:pl-8"
            >
              <p className="max-w-sm text-pretty text-lg leading-snug text-ink 2xl:text-xl">
                &ldquo;{ask.q}&rdquo;
              </p>
              <p className="max-w-sm text-sm leading-relaxed text-muted 2xl:text-base">
                &rarr; {ask.a}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
