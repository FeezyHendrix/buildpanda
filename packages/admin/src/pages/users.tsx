import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminApi, type AdminUserRow } from "@/api/admin";
import { Loading, ErrorState, PageHeader, RoleBadge, Badge, Avatar } from "@/components/ui";
import { DataTable, SearchBar, Pagination, type Column } from "@/components/data-table";
import { formatDate } from "@/lib/utils";

const LIMIT = 25;

const columns: Column<AdminUserRow>[] = [
  {
    key: "user",
    header: "User",
    render: (u) => (
      <div className="flex items-center gap-3">
        <Avatar name={u.name} image={u.image} />
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{u.name}</p>
          <p className="truncate text-xs text-muted">{u.email}</p>
        </div>
      </div>
    ),
  },
  { key: "role", header: "Role", render: (u) => <RoleBadge role={u.role} /> },
  {
    key: "status",
    header: "Status",
    render: (u) =>
      u.banned ? (
        <Badge tone="danger">Banned</Badge>
      ) : u.emailVerified ? (
        <Badge tone="success">Verified</Badge>
      ) : (
        <Badge tone="warning">Unverified</Badge>
      ),
  },
  { key: "projects", header: "Projects", render: (u) => u.projectCount },
  { key: "orgs", header: "Orgs", render: (u) => u.organizationCount },
  { key: "joined", header: "Joined", render: (u) => <span className="text-muted">{formatDate(u.createdAt)}</span> },
];

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "users", search, offset],
    queryFn: () => adminApi.listUsers({ search, limit: LIMIT, offset }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Users" description="Every account on the platform." />
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
          <DataTable columns={columns} rows={data.rows} rowHref={(u) => `/users/${u.id}`} emptyLabel="No users found." />
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
