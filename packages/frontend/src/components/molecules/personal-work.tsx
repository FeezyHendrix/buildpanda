import { Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { Badge } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";
import type { WorkItem } from "@/api/personal-work";
import { usePersonalWork } from "@/hooks/use-personal-work";
import { QueryError } from "./query-error";
import { formatShortDate } from "@/lib/formatters";

const ACTION_TONES = {
  "Your task": "info",
  "Your decision": "warning",
  "Your response": "accent",
} as const;

function ActionRow({ item }: { item: WorkItem & { projectName: string } }) {
  const tone = ACTION_TONES[item.kind as keyof typeof ACTION_TONES] ?? "neutral";
  return (
    <li>
      <Link
        className="group flex items-center gap-3 rounded-xl bg-white px-4 py-3.5 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        to={item.to}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-6 text-ink group-hover:text-primary-600">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs text-ink-muted">{item.projectName}</span>
            <Badge tone={tone} size="sm">{item.kind}</Badge>
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium text-ink-muted">
          {item.dueDate ? formatShortDate(item.dueDate) : "No due date"}
        </span>
      </Link>
    </li>
  );
}

export function PersonalWork({ projects }: { projects: readonly { id: string; name: string }[] }) {
  const work = usePersonalWork(projects);
  const empty = !work.pending && !work.error && work.items.length === 0;
  return (
    <Card className="mb-4 border-primary-500/15 bg-primary-50/50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Needs my action</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">Your next steps across projects, earliest due first.</p>
        </div>
        {work.items.length > 0 ? <Badge tone="info" size="md">{work.items.length} pending</Badge> : null}
      </div>
      {work.error ? <QueryError error={work.error} retry={work.refresh} noun="some assigned work" /> : null}
      {work.pending ? <div className="mt-4"><Spinner size="sm" /></div> : null}
      {empty ? <p className="mt-4 rounded-xl bg-white px-4 py-4 text-sm text-ink-muted">You're all caught up. No assigned actions are waiting.</p> : null}
      {work.items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {work.items.map(item => <ActionRow key={item.id} item={item} />)}
        </ul>
      ) : null}
    </Card>
  );
}

PersonalWork.displayName = "PersonalWork";
