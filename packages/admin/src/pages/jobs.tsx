import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminApi, type AdminImportJobRow } from "@/api/admin";
import { Badge, Loading, ErrorState, PageHeader } from "@/components/ui";
import { DataTable, SearchBar, Pagination, type Column } from "@/components/data-table";
import { cn, formatDate } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

const statuses = ["", "pending", "processing", "completed", "applied", "failed"];

type JobTone = "neutral" | "brand" | "success" | "warning" | "danger";

const statusTone: Record<string, JobTone> = {
  pending: "warning",
  processing: "brand",
  completed: "success",
  applied: "success",
  failed: "danger",
};

function JobStatusBadge({ value }: { value: string }) {
  return <Badge tone={statusTone[value] ?? "neutral"}>{value}</Badge>;
}

const KIND_LABEL: Record<string, string> = {
  programme: "Programme",
  boq: "BoQ",
};

const columns: Column<AdminImportJobRow>[] = [
  {
    key: "file",
    header: "File",
    render: (j) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{j.fileName}</p>
        <p className="truncate text-xs text-muted">
          {KIND_LABEL[j.kind] ?? j.kind} import · {j.item_count} items
        </p>
      </div>
    ),
  },
  {
    key: "requestedBy",
    header: "Requested by",
    render: (j) => (
      <div className="min-w-0">
        <p className="truncate text-ink">{j.requestedByName ?? "—"}</p>
        {j.organizationName ? (
          <p className="truncate text-xs text-muted">{j.organizationName}</p>
        ) : null}
      </div>
    ),
  },
  { key: "status", header: "Status", render: (j) => <JobStatusBadge value={j.status} /> },
  {
    key: "ai",
    header: "AI",
    render: (j) => (j.usedAi ? <Badge tone="brand">Panda AI</Badge> : <span className="text-muted">—</span>),
  },
  { key: "created", header: "Created", render: (j) => formatDate(j.createdAt) },
];

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AdminImportJobRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "jobs", search, status, offset],
    queryFn: () =>
      adminApi.listJobs({ search, status: status || undefined, limit: DEFAULT_PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Import jobs" description="Programme and BoQ imports processed by Panda AI." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setOffset(0);
          }}
          placeholder="Search by file name…"
        />
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => {
                setStatus(s);
                setOffset(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                status === s ? "bg-brand text-white" : "bg-surface-muted text-muted hover:text-ink",
              )}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>
      {isLoading && !data ? (
        <Loading />
      ) : isError || !data ? (
        <ErrorState />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data.rows}
            onRowClick={(j) => setSelected(j)}
            emptyLabel="No import jobs found."
          />
          <Pagination total={data.total} limit={DEFAULT_PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}
      {selected ? <JobDetailDialog job={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function JobDetailDialog({ job, onClose }: { job: AdminImportJobRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-ink">{job.fileName}</p>
            <p className="text-xs text-muted">
              {KIND_LABEL[job.kind] ?? job.kind} import · {job.item_count} items
            </p>
          </div>
          <JobStatusBadge value={job.status} />
        </div>
        <dl className="space-y-2 text-sm">
          <Row label="Requested by" value={job.requestedByName ?? job.requestedByEmail ?? "—"} />
          <Row label="Organization" value={job.organizationName ?? "—"} />
          <Row label="Used Panda AI" value={job.usedAi ? "Yes" : "No"} />
          <Row label="Created" value={formatDate(job.createdAt)} />
          <Row label="Updated" value={formatDate(job.updatedAt)} />
        </dl>
        {job.error ? (
          <div className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">
            <p className="mb-1 font-semibold">Error</p>
            <p className="whitespace-pre-wrap break-words">{job.error}</p>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-surface-muted px-4 py-2 text-sm font-semibold text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}
