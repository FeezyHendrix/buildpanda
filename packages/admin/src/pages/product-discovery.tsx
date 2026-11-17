import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { adminKeys } from "@/api/admin-keys";
import type { AdminProductDiscovery, DiscoveryQuestionKey } from "@/api/product-discovery";
import { Badge, Card, Loading, ErrorState, PageHeader } from "@/components/ui";
import { AsOf } from "@/components/chart-components";
import { BarList, Section, pct } from "@/components/bar-list";
import { DataTable, type Column } from "@/components/data-table";
import { PageContainer } from "@/components/page-container";
import { formatDate } from "@/lib/utils";

type Response = AdminProductDiscovery["responses"][number];

const QUESTIONS: { key: DiscoveryQuestionKey; title: string; hint: string }[] = [
  { key: "useCases", title: "What they want to use BuildPanda for", hint: "A signup can pick several." },
  { key: "referralSources", title: "How they heard about BuildPanda", hint: "A signup can pick several." },
  { key: "role", title: "Role", hint: "One answer each." },
  { key: "teamSize", title: "People in their company", hint: "One answer each." },
  { key: "activeProjects", title: "Projects running right now", hint: "One answer each." },
  { key: "currentTools", title: "How they manage projects today", hint: "A signup can pick several." },
];

const list = (values: string[]) => (values.length > 0 ? values.join(", ") : "—");

const columns: Column<Response>[] = [
  {
    key: "user",
    header: "User",
    render: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{r.name}</p>
        <p className="truncate text-xs text-muted">{r.email}</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Survey",
    render: (r) => (
      <div className="flex flex-wrap gap-1">
        <Badge tone={r.completed ? "success" : "neutral"}>{r.completed ? "Completed" : "Skipped early"}</Badge>
        {r.demoBooked ? <Badge tone="brand">Demo booked</Badge> : null}
      </div>
    ),
  },
  { key: "role", header: "Role", render: (r) => r.role ?? "—" },
  { key: "team", header: "Company", render: (r) => r.teamSize ?? "—" },
  { key: "projects", header: "Projects", render: (r) => r.activeProjects ?? "—" },
  { key: "uses", header: "Wants to use it for", render: (r) => list(r.useCases) },
  { key: "sources", header: "Heard via", render: (r) => list(r.referralSources) },
  { key: "tools", header: "Uses today", render: (r) => list(r.currentTools) },
  { key: "answered", header: "Answered", render: (r) => formatDate(r.answeredAt) },
];

export default function ProductDiscoveryPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: adminKeys.productDiscovery(),
    queryFn: () => adminApi.productDiscovery(),
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message="Could not load product discovery answers." />;

  const tiles = [
    { label: "New signups asked", value: data.asked.toLocaleString(), hint: "Signed up since the survey went live" },
    { label: "Responded", value: data.total.toLocaleString(), hint: `${pct(data.total, data.asked)} of new signups` },
    { label: "Finished every question", value: data.completed.toLocaleString(), hint: `${pct(data.completed, data.total)} of responses` },
    { label: "Demos booked", value: data.demosBooked.toLocaleString(), hint: `${pct(data.demosBooked, data.total)} of responses` },
  ];

  return (
    <PageContainer variant="wide" className="flex flex-col gap-6">
      <PageHeader
        title="Product discovery"
        description="What new signups told us when they first reached the dashboard."
        actions={<AsOf timestamp={data.asOf} />}
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
        {QUESTIONS.map((q) => (
          <Section key={q.key} title={q.title} hint={`${q.hint} Share is of all responses.`}>
            <BarList rows={data.counts[q.key] ?? []} total={data.total} />
          </Section>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Responses</h2>
          <p className="mt-1 text-xs text-muted">Newest first, up to 300. Open a user to see their account and reach out.</p>
        </div>
        <DataTable
          columns={columns}
          rows={data.responses}
          rowHref={(r) => `/users/${r.id}`}
          emptyLabel="No one has answered yet."
        />
      </div>
    </PageContainer>
  );
}
