import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  Loading,
  RoleBadge,
  StatusBadge,
} from "@/components/ui";
import { ChevronLeftIcon, ShieldIcon, BanIcon, TrashIcon } from "@/components/icons";
import { authClient } from "@/lib/auth-client";
import { formatDate } from "@/lib/utils";

export default function UserDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = authClient.useSession();

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => adminApi.getUser(id),
  });

  const update = useMutation({
    mutationFn: (body: { role?: string; banned?: boolean; banReason?: string }) =>
      adminApi.updateUser(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "user", id] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => adminApi.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      navigate("/users", { replace: true });
    },
  });

  if (isLoading) return <Loading />;
  if (isError || !user) return <ErrorState />;

  const isSelf = session?.user?.id === user.id;
  const busy = update.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/users" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ChevronLeftIcon className="h-4 w-4" /> Users
      </Link>

      <Card className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} image={user.image} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-ink">{user.name}</h1>
                <RoleBadge role={user.role} />
                {user.banned ? <Badge tone="danger">Banned</Badge> : null}
              </div>
              <p className="text-sm text-muted">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || isSelf}
              onClick={() => update.mutate({ role: user.role === "admin" ? "user" : "admin" })}
            >
              <ShieldIcon className="h-4 w-4" />
              {user.role === "admin" ? "Revoke admin" : "Make admin"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || isSelf}
              onClick={() => {
                if (user.banned) return update.mutate({ banned: false });
                const reason = window.prompt("Reason for banning this user? (optional)") ?? undefined;
                update.mutate({ banned: true, banReason: reason });
              }}
            >
              <BanIcon className="h-4 w-4" />
              {user.banned ? "Unban" : "Ban"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy || isSelf}
              onClick={() => {
                if (window.confirm(`Permanently delete ${user.name}? This cannot be undone.`)) {
                  remove.mutate();
                }
              }}
            >
              <TrashIcon className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-3">
          <Field label="Account type" value={user.accountType} />
          <Field label="Profession" value={user.profession} />
          <Field label="Country" value={user.country} />
          <Field label="Phone" value={user.phone} />
          <Field label="Email verified" value={user.emailVerified ? "Yes" : "No"} />
          <Field label="Joined" value={formatDate(user.createdAt)} />
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Organizations ({user.memberships.length})</h2>
          {user.memberships.length === 0 ? (
            <p className="text-sm text-muted">No memberships.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {user.memberships.map((m) => (
                <li key={m.organizationId} className="flex items-center justify-between py-2.5">
                  <Link to={`/organizations/${m.organizationId}`} className="text-sm font-medium text-ink hover:text-brand">
                    {m.organizationName}
                  </Link>
                  <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{m.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Owned projects ({user.projects.length})</h2>
          {user.projects.length === 0 ? (
            <p className="text-sm text-muted">No projects owned.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {user.projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <Link to={`/projects/${p.id}`} className="truncate text-sm font-medium text-ink hover:text-brand">
                    {p.name}
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{value || "—"}</dd>
    </div>
  );
}
