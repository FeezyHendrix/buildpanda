import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminApi, type AdminProjectRow } from "@/api/admin";
import { Loading, ErrorState, PageHeader, StatusBadge } from "@/components/ui";
import { DataTable, SearchBar, Pagination, type Column } from "@/components/data-table";
import { cn, formatMoney } from "@/lib/utils";

const LIMIT = 25;

const statuses = ["", "On Track", "At Risk", "Delayed"];

const columns: Column<AdminProjectRow>[] = [
  {
    key: "project",
    header: "Project",
    render: (p) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{p.name}</p>
        <p className="truncate text-xs text-muted">{p.address ?? "—"}</p>
      </div>
    ),
  },
  {
    key: "owner",
    header: "Owner",
    render: (p) => (
      <div className="min-w-0">
        <p className="truncate text-ink">{p.ownerName ?? "—"}</p>
        {p.organizationName ? <p className="truncate text-xs text-muted">{p.organizationName}</p> : null}
      </div>
    ),
  },
  { key: "status", header: "Status", render: (p) => <StatusBadge value={p.status} /> },
  {
    key: "progress",
    header: "Progress",
    render: (p) => (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-brand" style={{ width: `${p.progress_percent ?? 0}%` }} />
        </div>
        <span className="text-xs text-muted">{p.progress_percent ?? 0}%</span>
      </div>
    ),
  },
  { key: "budget", header: "Budget", render: (p) => formatMoney(p.budget_total, p.currency) },
];

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "projects", search, status, offset],
    queryFn: () => adminApi.listProjects({ search, status: status || undefined, limit: LIMIT, offset }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Projects" description="Every project across all organizations." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setOffset(0);
          }}
          placeholder="Search by name or address…"
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
            rowHref={(p) => `/projects/${p.id}`}
            emptyLabel="No projects found."
          />
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
