import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { Badge, Card, ErrorState, Loading, StatusBadge } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";
import { formatDate } from "@/lib/utils";

export default function OrganizationDetailPage() {
  const { id = "" } = useParams();
  const { data: org, isLoading, isError } = useQuery({
    queryKey: ["admin", "organization", id],
    queryFn: () => adminApi.getOrganization(id),
  });

  if (isLoading) return <Loading />;
  if (isError || !org) return <ErrorState />;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/organizations" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ChevronLeftIcon className="h-4 w-4" /> Organizations
      </Link>

      <Card className="flex flex-col gap-2 p-6">
        <h1 className="text-xl font-bold text-ink">{org.name}</h1>
        <p className="text-sm text-muted">
          {org.slug} · Created {formatDate(org.createdAt)}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Members ({org.members.length})</h2>
          {org.members.length === 0 ? (
            <p className="text-sm text-muted">No members.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {org.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to={`/users/${m.userId}`} className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink hover:text-brand">{m.name}</p>
                    <p className="truncate text-xs text-muted">{m.email}</p>
                  </Link>
                  <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{m.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Projects ({org.projects.length})</h2>
          {org.projects.length === 0 ? (
            <p className="text-sm text-muted">No projects.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {org.projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to={`/projects/${p.id}`} className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink hover:text-brand">{p.name}</p>
                    <p className="truncate text-xs text-muted">{p.ownerName ?? "—"}</p>
                  </Link>
                  <StatusBadge value={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
