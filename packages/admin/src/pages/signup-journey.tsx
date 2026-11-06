import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import type { AdminSignupJourney } from "@/api/signup-journey";
import { adminKeys } from "@/api/admin-keys";
import { Card, Loading, ErrorState, PageHeader } from "@/components/ui";
import { DateRangePicker, AsOf } from "@/components/chart-components";
import { DataTable, type Column } from "@/components/data-table";
import { PageContainer } from "@/components/page-container";
import { cn, formatDate } from "@/lib/utils";

type StalledUser = AdminSignupJourney["stalled"][number];
type Segment = AdminSignupJourney["segments"][number];

const pct = (value: number, total: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : "—");

function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} hr`;
  return `${Math.round(hours / 24)} days`;
}

function Section({ title, hint, className, children }: { title: string; hint: string; className?: string; children: ReactNode }) {
  return (
    <Card className={cn("flex flex-col gap-4 p-5", className)}>
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-xs text-muted">{hint}</p>
      </div>
      {children}
    </Card>
  );
}

function BarList({ rows, total }: { rows: { label: string; value: number; note?: string }[]; total: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink">{r.label}</span>
            <span className="whitespace-nowrap text-muted">
              {r.note ? `${r.note} · ` : ""}
              <span className="font-semibold text-ink">{r.value.toLocaleString()}</span> · {pct(r.value, total)}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: total > 0 ? `${(r.value / total) * 100}%` : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const th = "py-2 text-xs font-semibold uppercase tracking-wide text-muted";
const td = "py-2.5 text-ink";

function SegmentTable({ heading, rows }: { heading: string; rows: Segment[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left">
          <th className={th}>{heading}</th>
          <th className={cn(th, "text-right")}>Signups</th>
          <th className={cn(th, "text-right")}>Started</th>
          <th className={cn(th, "text-right")}>Did real work</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.segment} className="border-b border-line last:border-0">
            <td className={td}>{s.segment}</td>
            <td className={cn(td, "text-right")}>{s.signups.toLocaleString()}</td>
            <td className={cn(td, "text-right")}>{pct(s.started, s.signups)}</td>
            <td className={cn(td, "text-right")}>{pct(s.worked, s.signups)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const stalledColumns: Column<StalledUser>[] = [
  {
    key: "user",
    header: "User",
    render: (u) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{u.name}</p>
        <p className="truncate text-xs text-muted">{u.email}</p>
      </div>
    ),
  },
  { key: "step", header: "Stopped at", render: (u) => u.step },
  { key: "type", header: "Account type", render: (u) => u.accountType ?? "—" },
  { key: "arrived", header: "Arrived", render: (u) => (u.invited ? "Invited" : "On their own") },
  { key: "country", header: "Country", render: (u) => u.country ?? "—" },
  { key: "signedUp", header: "Signed up", render: (u) => formatDate(u.createdAt) },
  { key: "lastSeen", header: "Last seen", render: (u) => (u.lastActivityAt ? formatDate(u.lastActivityAt) : "Never") },
];

export default function SignupJourneyPage() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [step, setStep] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: adminKeys.metricsSignupJourney(range),
    queryFn: () => adminApi.metricsSignupJourney(range),
  });

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState />;

  const { total, funnel, activation, timeToValue } = data;
  const at = (i: number) => funnel[i]?.value ?? 0;
  const neverOpened = total - at(2);
  const gotToWork = timeToValue.buckets.reduce((sum, b) => sum + b.value, 0);
  const tiles = [
    { label: "Signups", value: total.toLocaleString(), hint: "in the selected range" },
    { label: "Never opened the app", value: pct(neverOpened, total), hint: `${neverOpened.toLocaleString()} signups` },
    {
      label: "Did real work in their first 7 days",
      value: pct(activation.activated, activation.eligible),
      hint: `${activation.activated.toLocaleString()} of ${activation.eligible.toLocaleString()} signups at least a week old`,
    },
    {
      label: "Typical time to first real work",
      value: formatHours(timeToValue.medianHours),
      hint: `median, among the ${gotToWork.toLocaleString()} who got there`,
    },
  ];
  // Drop-off is the gap to the next step: the people whose journey ended here.
  const funnelRows = funnel.map((f, i) => {
    const lost = i < funnel.length - 1 ? f.value - at(i + 1) : 0;
    return { label: f.step, value: f.value, note: lost > 0 ? `${lost.toLocaleString()} stopped here` : undefined };
  });
  const stalledSteps = funnel.slice(0, -1).map((f) => f.step);
  const stalled = step ? data.stalled.filter((u) => u.step === step) : data.stalled;

  return (
    <PageContainer variant="wide" className="flex flex-col gap-6">
      <PageHeader
        title="Signup journey"
        description="How far new signups get, and where they stop."
        actions={
          <div className="flex flex-col items-end gap-1">
            <DateRangePicker value={range} onChange={setRange} />
            <AsOf timestamp={data.asOf} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="flex flex-col gap-1 p-5">
            <span className="text-sm text-muted">{t.label}</span>
            <span className="text-2xl font-bold text-ink">{t.value}</span>
            <span className="text-xs text-muted">{t.hint}</span>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Where they stop" hint="Each signup is counted up to the furthest step they reached.">
          <BarList rows={funnelRows} total={total} />
        </Section>
        <Section
          title="Last seen after signing up"
          hint="Time between signing up and their most recent visit. Recent signups have not had time to reach the later rows."
        >
          <BarList rows={data.lastSeen} total={total} />
        </Section>
        <Section
          title="Time to first real work"
          hint="From signing up to their first task, log, take-off, message, upload or invite. Only signups who got there."
        >
          <BarList rows={timeToValue.buckets} total={gotToWork} />
        </Section>
        <Section title="Who gets going" hint="Which kind of signup starts and does real work, and which does not.">
          {["Account type", "How they arrived"].map((group) => (
            <SegmentTable key={group} heading={group} rows={data.segments.filter((s) => s.group === group)} />
          ))}
        </Section>
        <Section
          className="lg:col-span-2"
          title="What they did, and whether they came back"
          hint="Came back = seen again a week or more after signing up, compared on signups at least two weeks old (use 30d or 90d). A wide gap between the last two columns marks a first-week action worth steering new signups toward. Small counts can mislead."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className={th}>Action</th>
                  <th className={cn(th, "text-right")}>Ever did it</th>
                  <th className={cn(th, "text-right")}>Did it in week 1</th>
                  <th className={cn(th, "text-right")}>Came back, if they did</th>
                  <th className={cn(th, "text-right")}>Came back, if they did not</th>
                </tr>
              </thead>
              <tbody>
                {data.actions.map((a) => (
                  <tr key={a.label} className="border-b border-line last:border-0">
                    <td className={td}>{a.label}</td>
                    <td className={cn(td, "text-right")}>
                      {a.users.toLocaleString()} <span className="text-muted">· {pct(a.users, total)}</span>
                    </td>
                    <td className={cn(td, "text-right")}>{a.weekOne.toLocaleString()}</td>
                    <td className={cn(td, "text-right")}>{pct(a.weekOneCameBack, a.weekOne)}</td>
                    <td className={cn(td, "text-right")}>{pct(a.othersCameBack, a.others)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Signups who stopped short</h2>
            <p className="mt-1 text-xs text-muted">
              Newest first, up to 300. Open a user to see their account and reach out.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-md bg-gray-50 p-1 text-sm">
            {[null, ...stalledSteps].map((s) => (
              <button
                key={s ?? "all"}
                type="button"
                aria-pressed={step === s}
                onClick={() => setStep(s)}
                className={cn(
                  "rounded px-3 py-1 transition-colors",
                  step === s ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {s ?? "All"}
              </button>
            ))}
          </div>
        </div>
        <DataTable
          columns={stalledColumns}
          rows={stalled}
          rowHref={(u) => `/users/${u.id}`}
          emptyLabel="Nobody stopped at this step in the selected range."
        />
      </div>
    </PageContainer>
  );
}
