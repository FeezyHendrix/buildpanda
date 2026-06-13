import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminLeadRow, type AdminOrgRow } from "@/api/admin";
import {
  Loading,
  ErrorState,
  PageHeader,
  Badge,
  Button,
  Input,
} from "@/components/ui";
import { DataTable, SearchBar, Pagination, type Column } from "@/components/data-table";
import { formatDate } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  New: "brand",
  Contacted: "brand",
  Qualified: "warning",
  ProposalOpened: "neutral",
  Won: "success",
  Lost: "danger",
};

function AssignDialog({
  lead,
  onClose,
}: {
  lead: AdminLeadRow;
  onClose: () => void;
}) {
  const [orgSearch, setOrgSearch] = useState("");
  const qc = useQueryClient();

  const { data: orgs } = useQuery({
    queryKey: ["admin", "organizations", orgSearch],
    queryFn: () => adminApi.listOrganizations({ search: orgSearch, limit: 20 }),
  });

  const assign = useMutation({
    mutationFn: (orgId: string) => adminApi.assignLead(lead.id, orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "leads"] });
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-ink">Assign lead to organisation</h2>
        <p className="mt-1 text-sm text-muted">
          "{lead.name}" · {lead.email}
        </p>

        <div className="mt-4">
          <Input
            placeholder="Search organisations…"
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
            autoFocus
          />
        </div>

        <ul className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-line">
          {(orgs?.rows ?? []).map((org: AdminOrgRow) => (
            <li key={org.id}>
              <button
                type="button"
                disabled={assign.isPending}
                onClick={() => assign.mutate(org.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm text-ink transition-colors hover:bg-surface-muted disabled:opacity-50"
              >
                <span className="font-medium">{org.name}</span>
                <span className="text-xs text-muted">{org.memberCount} members</span>
              </button>
            </li>
          ))}
          {orgs?.rows.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted">No organisations found.</li>
          )}
        </ul>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [assignTarget, setAssignTarget] = useState<AdminLeadRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "leads", search, offset],
    queryFn: () => adminApi.listLeads({ search, limit: DEFAULT_PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<AdminLeadRow>[] = [
    {
      key: "contact",
      header: "Contact",
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{l.name}</p>
          <p className="truncate text-xs text-muted">{l.email}</p>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (l) => <span className="text-muted">{l.location ?? "—"}</span>,
    },
    {
      key: "type",
      header: "Project type",
      render: (l) => <span className="text-muted">{l.project_type ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (l) => (
        <Badge tone={STATUS_TONE[l.status] ?? "neutral"}>
          {l.status === "ProposalOpened" ? "Proposal Opened" : l.status}
        </Badge>
      ),
    },
    {
      key: "org",
      header: "Organisation",
      render: (l) =>
        l.organizationName ? (
          <span className="text-sm text-ink">{l.organizationName}</span>
        ) : (
          <Badge tone="warning">Unassigned</Badge>
        ),
    },
    {
      key: "received",
      header: "Received",
      render: (l) => <span className="text-muted">{formatDate(l.created_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (l) =>
        l.org_id === null ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setAssignTarget(l);
            }}
          >
            Assign
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Leads"
        description="Consultation enquiries from the marketing site."
      />
      <SearchBar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setOffset(0);
        }}
        placeholder="Search by name or email…"
      />
      {isLoading && !data ? (
        <Loading />
      ) : isError || !data ? (
        <ErrorState />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data.rows}
            emptyLabel="No leads found."
          />
          <Pagination total={data.total} limit={DEFAULT_PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}

      {assignTarget && (
        <AssignDialog lead={assignTarget} onClose={() => setAssignTarget(null)} />
      )}
    </div>
  );
}
