import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { Card, ErrorState, Loading, StatusBadge, Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/data-table";
import { ChevronLeftIcon } from "@/components/icons";
import { cn, formatDate, formatMoney } from "@/lib/utils";

type Row = Record<string, unknown>;

const TABS = [
  "Overview",
  "Finances",
  "Inspections",
  "Documents",
  "Activities",
  "Updates",
  "Daily logs",
  "Risks",
] as const;
type Tab = (typeof TABS)[number];

const TAB_KIND: Partial<Record<Tab, string>> = {
  Inspections: "inspections",
  Documents: "documents",
  Activities: "activities",
  Updates: "updates",
  "Daily logs": "daily-logs",
  Risks: "risks",
};

export default function ProjectDetailPage() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<Tab>("Overview");

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ["admin", "project", id],
    queryFn: () => adminApi.getProject(id),
  });

  if (isLoading) return <Loading />;
  if (isError || !project) return <ErrorState />;

  const currency = (project.currency as string) ?? "NGN";

  return (
    <div className="flex flex-col gap-6">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ChevronLeftIcon className="h-4 w-4" /> Projects
      </Link>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-ink">{project.name as string}</h1>
              <StatusBadge value={project.status as string} />
              {project.risk ? <Badge tone="neutral">Risk: {project.risk as string}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {(project.address as string) ?? "—"}
            </p>
            <p className="mt-1 text-sm text-muted">
              Owner: {project.ownerName ?? "—"}
              {project.organizationName ? ` · ${project.organizationName}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-ink">{project.progress_percent ?? 0}%</p>
            <p className="text-xs text-muted">complete</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 sm:grid-cols-4">
          <Field label="Budget" value={formatMoney(project.budget_total as number, currency)} />
          <Field label="Spent" value={formatMoney(project.budget_used as number, currency)} />
          <Field label="Created" value={formatDate(project.created_at as string)} />
          <Field label="Currency" value={currency} />
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Object.entries(project.counts).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-faint px-3 py-2 text-center">
              <p className="text-lg font-bold text-ink">{v as number}</p>
              <p className="text-[11px] capitalize text-muted">{k.replace(/([A-Z])/g, " $1")}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              tab === t ? "bg-brand text-white" : "bg-white text-muted hover:text-ink border border-line",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <OverviewTab project={project} currency={currency} />
      ) : tab === "Finances" ? (
        <FinancesTab id={id} currency={currency} />
      ) : (
        <CollectionTab id={id} tab={tab} />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function OverviewTab({ project, currency }: { project: Row; currency: string }) {
  const finances = project.finances as Row | null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Finance summary</h2>
        {finances ? (
          <dl className="grid grid-cols-2 gap-y-3">
            <Stat label="Total budget" value={formatMoney(finances.total_budget as number, currency)} />
            <Stat label="Deposited" value={formatMoney(finances.funds_deposited as number, currency)} />
            <Stat label="Released" value={formatMoney(finances.funds_released as number, currency)} />
            <Stat label="In escrow" value={formatMoney(finances.locked_in_escrow as number, currency)} />
            <Stat label="Remaining" value={formatMoney(finances.remaining_balance as number, currency)} />
          </dl>
        ) : (
          <p className="text-sm text-muted">No finance record.</p>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Project setup</h2>
        <pre className="max-h-72 overflow-auto rounded-lg bg-surface-faint p-3 text-xs text-muted">
          {JSON.stringify(project.setup ?? {}, null, 2)}
        </pre>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

const COLLECTION_COLUMNS: Record<string, Column<Row>[]> = {
  Inspections: [
    { key: "title", header: "Title", render: (r) => (r.title as string) ?? "—" },
    { key: "category", header: "Category", render: (r) => (r.category as string) ?? "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status as string} /> },
    { key: "risk", header: "Risk", render: (r) => (r.risk_level as string) ?? "—" },
    { key: "scheduled", header: "Scheduled", render: (r) => formatDate(r.scheduled_at as string) },
  ],
  Documents: [
    { key: "file", header: "File", render: (r) => (r.file_name as string) ?? "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status as string} /> },
    { key: "size", header: "Size", render: (r) => (r.size as string) ?? "—" },
    { key: "uploaded", header: "Uploaded", render: (r) => formatDate((r.uploaded_at as string) ?? (r.created_at as string)) },
  ],
  Activities: [
    { key: "name", header: "Activity", render: (r) => (r.name as string) ?? "—" },
    { key: "type", header: "Type", render: (r) => (r.activity_type as string) ?? "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status as string} /> },
    { key: "start", header: "Planned start", render: (r) => formatDate(r.planned_start_at as string) },
  ],
  Updates: [
    { key: "title", header: "Title", render: (r) => (r.title as string) ?? "—" },
    { key: "category", header: "Category", render: (r) => (r.category as string) ?? "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status as string} /> },
    { key: "created", header: "Created", render: (r) => formatDate(r.created_at as string) },
  ],
  "Daily logs": [
    { key: "date", header: "Date", render: (r) => formatDate(r.log_date as string) },
    { key: "weather", header: "Weather", render: (r) => (r.weather_condition as string) ?? "—" },
    { key: "present", header: "Workers", render: (r) => `${r.workers_present ?? "—"}/${r.workers_expected ?? "—"}` },
    { key: "hours", header: "Hours", render: (r) => (r.total_hours as number) ?? "—" },
  ],
  Risks: [
    { key: "title", header: "Risk", render: (r) => (r.title as string) ?? "—" },
    { key: "severity", header: "Severity", render: (r) => <StatusBadge value={r.severity as string} /> },
    { key: "created", header: "Created", render: (r) => formatDate(r.created_at as string) },
  ],
};

function CollectionTab({ id, tab }: { id: string; tab: Tab }) {
  const kind = TAB_KIND[tab]!;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "project", id, kind],
    queryFn: () => adminApi.projectCollection<Row[]>(id, kind),
  });

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState />;

  return (
    <DataTable
      columns={COLLECTION_COLUMNS[tab] ?? []}
      rows={data}
      emptyLabel={`No ${tab.toLowerCase()} for this project.`}
    />
  );
}

function FinancesTab({ id, currency }: { id: string; currency: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "project", id, "finances"],
    queryFn: () =>
      adminApi.projectCollection<{
        summary: Row | null;
        budgetPhases: Row[];
        materials: Row[];
        milestones: Row[];
        ledger: Row[];
      }>(id, "finances"),
  });

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState />;

  const milestoneCols: Column<Row>[] = [
    { key: "name", header: "Milestone", render: (r) => (r.name as string) ?? "—" },
    { key: "phase", header: "Phase", render: (r) => (r.phase as string) ?? "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status as string} /> },
    { key: "signoff", header: "Sign-off", render: (r) => <StatusBadge value={r.inspector_sign_off as string} /> },
    { key: "amount", header: "Amount", render: (r) => formatMoney(r.amount as number, currency) },
  ];
  const ledgerCols: Column<Row>[] = [
    { key: "date", header: "Date", render: (r) => formatDate(r.entry_date as string) },
    { key: "desc", header: "Description", render: (r) => (r.description as string) ?? "—" },
    { key: "type", header: "Type", render: (r) => <StatusBadge value={r.type as string} /> },
    { key: "amount", header: "Amount", render: (r) => formatMoney(r.amount as number, currency) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Milestone payments</h2>
        <DataTable columns={milestoneCols} rows={data.milestones} emptyLabel="No milestones." />
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Payment ledger</h2>
        <DataTable columns={ledgerCols} rows={data.ledger} emptyLabel="No ledger entries." />
      </div>
    </div>
  );
}
