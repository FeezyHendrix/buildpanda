import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { Card, Loading, ErrorState, PageHeader, StatusBadge, RoleBadge } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: adminApi.overview,
  });

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState />;

  const stats = [
    { label: "Users", value: data.counts.users, to: "/users" },
    { label: "Organizations", value: data.counts.organizations, to: "/organizations" },
    { label: "Projects", value: data.counts.projects, to: "/projects" },
    { label: "Inspections", value: data.counts.inspections },
    { label: "Documents", value: data.counts.documents },
    { label: "Open disputes", value: data.counts.openDisputes },
    { label: "Unassigned leads", value: data.counts.unassignedLeads, to: "/leads" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Platform-wide overview of BuildPanda." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => {
          const body = (
            <Card className="flex flex-col gap-1 p-5 transition-shadow hover:shadow-sm">
              <span className="text-sm text-muted">{s.label}</span>
              <span className="text-3xl font-bold text-ink">{s.value.toLocaleString()}</span>
            </Card>
          );
          return s.to ? (
            <Link key={s.label} to={s.to}>
              {body}
            </Link>
          ) : (
            <div key={s.label}>{body}</div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-1 p-5">
          <span className="text-sm text-muted">Total budget across projects</span>
          <span className="text-2xl font-bold text-ink">{formatMoney(data.finance.totalBudget)}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-5">
          <span className="text-sm text-muted">Funds released</span>
          <span className="text-2xl font-bold text-ink">{formatMoney(data.finance.fundsReleased)}</span>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Newest users</h2>
          <ul className="flex flex-col divide-y divide-line">
            {data.recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link to={`/users/${u.id}`} className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink hover:text-brand">{u.name}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </Link>
                <RoleBadge role={u.role} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Newest projects</h2>
          <ul className="flex flex-col divide-y divide-line">
            {data.recentProjects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link to={`/projects/${p.id}`} className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink hover:text-brand">{p.name}</p>
                  <p className="truncate text-xs text-muted">
                    {p.ownerName ?? "—"}
                    {p.organizationName ? ` · ${p.organizationName}` : ""} · {formatDate(p.created_at)}
                  </p>
                </Link>
                <StatusBadge value={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
