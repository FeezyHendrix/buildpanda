import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  adminApi,
  type InspectionRequestRow,
  type InspectionServiceStatus,
} from "@/api/admin";
import { adminKeys } from "@/api/admin-keys";
import { AssignInspectorDialog } from "@/components/assign-inspector-dialog";
import { DataTable, Pagination, SearchBar, type Column } from "@/components/data-table";
import { PageContainer } from "@/components/page-container";
import { Badge, Button, ErrorState, Loading, PageHeader } from "@/components/ui";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { cn, formatDate, formatMoney } from "@/lib/utils";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const SERVICE_TONE: Record<InspectionServiceStatus, Tone> = {
  Requested: "warning",
  Scheduled: "brand",
  Attended: "brand",
  Reported: "success",
  Cancelled: "neutral",
};

const FILTERS = [
  { label: "All", value: "" },
  { label: "Requested", value: "Requested" },
  { label: "Scheduled", value: "Scheduled" },
  { label: "Attended", value: "Attended" },
  { label: "Reported", value: "Reported" },
  { label: "Cancelled", value: "Cancelled" },
] as const;

function outcomeBadge(row: InspectionRequestRow) {
  if (row.outcome === "pass") return <Badge tone="success">✓ Pass</Badge>;
  if (row.outcome === "fail") return <Badge tone="danger">✕ Fail</Badge>;
  return <span className="text-muted">—</span>;
}

/**
 * Every inspection ordered on the platform. An inspection is an independent
 * service: the client asks, BuildPanda sends its own inspector, and only that
 * inspector may record what they found — so assigning one here is what turns a
 * request into a job somebody can actually report on.
 */
export default function InspectionRequestsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | InspectionServiceStatus>("");
  const [offset, setOffset] = useState(0);
  const [assignTarget, setAssignTarget] = useState<InspectionRequestRow | null>(null);

  const args = {
    ...(search ? { search } : {}),
    ...(status ? { serviceStatus: status } : {}),
    limit: DEFAULT_PAGE_SIZE,
    offset,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: adminKeys.inspectionRequests.list(args),
    queryFn: () => adminApi.listInspectionRequests(args),
    placeholderData: keepPreviousData,
  });

  const columns: Column<InspectionRequestRow>[] = [
    {
      key: "request",
      header: "Request",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.title}</p>
          <p className="truncate text-xs text-muted">
            {row.category} · {row.projectName ?? "Unnamed project"}
          </p>
        </div>
      ),
    },
    {
      key: "subject",
      header: "Contractor inspected",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{row.contractorName ?? "—"}</p>
          <p className="truncate text-xs text-muted">{row.organizationName ?? "No workspace"}</p>
        </div>
      ),
    },
    {
      key: "requester",
      header: "Requested by",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{row.requestedByName ?? "—"}</p>
          <p className="truncate text-xs text-muted">{row.requestedBySide}-side</p>
        </div>
      ),
    },
    {
      key: "service",
      header: "Service status",
      render: (row) => <Badge tone={SERVICE_TONE[row.serviceStatus]}>{row.serviceStatus}</Badge>,
    },
    {
      key: "inspector",
      header: "Inspector",
      render: (row) =>
        row.inspectorUserId ? (
          <span className="text-sm text-ink">{row.inspectorName}</span>
        ) : (
          <Badge tone="warning">Unassigned</Badge>
        ),
    },
    { key: "outcome", header: "Outcome", render: outcomeBadge },
    {
      key: "visit",
      header: "Visit",
      render: (row) => <span className="text-muted">{formatDate(row.scheduledAt)}</span>,
    },
    {
      key: "fee",
      header: "Fee recorded",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums text-muted">
          {row.feeAmount === null ? "—" : formatMoney(row.feeAmount, row.feeCurrency ?? "NGN")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        row.serviceStatus === "Cancelled" ? null : (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setAssignTarget(row);
            }}
          >
            {row.inspectorUserId ? "Reassign" : "Assign"}
          </Button>
        ),
    },
  ];

  return (
    <PageContainer className="flex flex-col gap-5">
      <PageHeader
        title="Inspection requests"
        description="Independent inspections ordered across every project. BuildPanda assigns the inspector; only that inspector may record the findings and issue the report."
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={(value) => {
            setSearch(value);
            setOffset(0);
          }}
          placeholder="Search by title, contractor or project…"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                setStatus(filter.value as "" | InspectionServiceStatus);
                setOffset(0);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                status === filter.value
                  ? "bg-brand text-white"
                  : "bg-surface-muted text-muted hover:text-ink",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {data ? <p className="ml-auto text-sm text-muted">{data.total} requests</p> : null}
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
            emptyLabel="No inspection requests match these filters."
          />
          <Pagination
            total={data.total}
            limit={DEFAULT_PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
          />
        </>
      )}

      {assignTarget ? (
        <AssignInspectorDialog request={assignTarget} onClose={() => setAssignTarget(null)} />
      ) : null}
    </PageContainer>
  );
}
