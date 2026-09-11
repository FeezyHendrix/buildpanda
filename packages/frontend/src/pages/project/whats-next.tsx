import { Card } from "@/components/atoms/card";
import { Badge } from "@/components/atoms/badge";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { Spinner } from "@/components/atoms/spinner";
import { useProjectContext } from "@/layouts/project-layout";
import { useWhatsNext } from "@/hooks/use-insights";
import { formatDayMonth as fmt } from "@/lib/formatters";
import type { ReactNode } from "react";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <Badge tone="info" size="sm">
          {count}
        </Badge>
      </div>
      <ul className="flex flex-col divide-y divide-[#F0F0F0]">{children}</ul>
    </Card>
  );
}

function Row({ label, meta }: { label: string; meta?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="min-w-0 truncate text-sm text-gray-900">{label}</span>
      {meta && <span className="shrink-0 text-xs text-gray-500">{meta}</span>}
    </li>
  );
}

export default function ProjectWhatsNext() {
  const { project } = useProjectContext();
  const { data, isLoading } = useWhatsNext(project.id, 14);

  if (isLoading || !data) {
    return (
      <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
        <PageHeader
          title="What's next"
        />
        <div className="flex justify-center py-10">
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  const total =
    data.stagesInProgress.length +
    data.upcomingStages.length +
    data.dueActionItems.length +
    data.dueQueries.length +
    data.dueApprovals.length +
    data.upcomingKeyDates.length +
    data.expiringPermits.length;

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="What's next"
      />

      {total === 0 ? (
        <EmptyState
          icon={<CalendarIcon />}
          title="Nothing due in the next two weeks"
          description="You're all caught up."
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section
            title="Stages in progress"
            count={data.stagesInProgress.length}
          >
            {data.stagesInProgress.map((s) => (
              <Row key={s.id} label={s.name} meta={`${s.progress_percent}%`} />
            ))}
          </Section>
          <Section title="Starting soon" count={data.upcomingStages.length}>
            {data.upcomingStages.map((s) => (
              <Row key={s.id} label={s.name} meta={fmt(s.start_date)} />
            ))}
          </Section>
          <Section title="Action items due" count={data.dueActionItems.length}>
            {data.dueActionItems.map((a) => (
              <Row
                key={a.id}
                label={a.title}
                meta={`${a.priority} · ${fmt(a.due_date)}`}
              />
            ))}
          </Section>
          <Section title="Open queries due" count={data.dueQueries.length}>
            {data.dueQueries.map((q) => (
              <Row key={q.id} label={q.subject} meta={fmt(q.due_date)} />
            ))}
          </Section>
          <Section title="Approvals awaiting" count={data.dueApprovals.length}>
            {data.dueApprovals.map((a) => (
              <Row key={a.id} label={a.title} meta={fmt(a.due_date)} />
            ))}
          </Section>
          <Section title="Key dates" count={data.upcomingKeyDates.length}>
            {data.upcomingKeyDates.map((k) => (
              <Row key={k.id} label={k.label} meta={fmt(k.target_date)} />
            ))}
          </Section>
          <Section title="Permits expiring" count={data.expiringPermits.length}>
            {data.expiringPermits.map((p) => (
              <Row key={p.id} label={p.title} meta={fmt(p.expiry_date)} />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}
