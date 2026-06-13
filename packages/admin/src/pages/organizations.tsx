import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminApi, type AdminOrgRow } from "@/api/admin";
import { Loading, ErrorState, PageHeader } from "@/components/ui";
import { DataTable, SearchBar, Pagination, type Column } from "@/components/data-table";
import { formatDate } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

const columns: Column<AdminOrgRow>[] = [
  {
    key: "org",
    header: "Organization",
    render: (o) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{o.name}</p>
        <p className="truncate text-xs text-muted">{o.slug}</p>
      </div>
    ),
  },
  { key: "members", header: "Members", render: (o) => o.memberCount },
  { key: "projects", header: "Projects", render: (o) => o.projectCount },
  { key: "created", header: "Created", render: (o) => <span className="text-muted">{formatDate(o.createdAt)}</span> },
];

export default function OrganizationsPage() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "organizations", search, offset],
    queryFn: () => adminApi.listOrganizations({ search, limit: DEFAULT_PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Organizations" description="Companies and teams using BuildPanda." />
      <SearchBar
        value={search}
        onChange={(v) => {
          setSearch(v);
          setOffset(0);
        }}
        placeholder="Search by name or slug…"
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
            rowHref={(o) => `/organizations/${o.id}`}
            emptyLabel="No organizations found."
          />
          <Pagination total={data.total} limit={DEFAULT_PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
