import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { Badge } from "@/components/atoms/badge";
import { RouteBreadcrumbs } from "@/components/molecules/breadcrumbs";
import { useMyProjects } from "@/hooks/use-participants";
import { authClient } from "@/lib/auth-client";
import logo from "@/assets/images/logo.svg";

function money(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export default function MyBuild() {
  const { data: projects = [], isLoading } = useMyProjects();
  const navigate = useNavigate();

  async function signOut() {
    await authClient.signOut();
    navigate("/auth/sign-in", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="flex h-16 items-center justify-between border-b border-[#F0F0F0] bg-white px-6">
        <img src={logo} alt="BuildPanda" className="h-8 w-auto" />
        <button type="button" onClick={signOut} className="text-sm font-medium text-gray-500 hover:text-gray-900">
          Sign out
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <RouteBreadcrumbs className="mb-6" />
        <h1 className="text-2xl font-bold text-gray-900">My Build</h1>
        <p className="mt-1 text-sm text-gray-500">Follow your project's progress, approve selections and ask questions.</p>

        <div className="mt-8">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : projects.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="text-sm font-medium text-gray-900">No projects yet</p>
              <p className="mt-1 text-sm text-gray-500">
                When your builder invites you to a project, it will appear here.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {projects.map((p) => (
                <Link key={p.id} to={`/project/${p.id}/overview`}>
                  <Card padding="md" interactive className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{p.name}</p>
                        <p className="truncate text-xs text-gray-500">{p.address ?? ""}</p>
                      </div>
                      <Badge tone="success" size="sm">{p.status}</Badge>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Progress</span>
                        <span>{p.progress_percent ?? 0}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#F0F0F0]">
                        <div className="h-full rounded-full bg-[#004DE7]" style={{ width: `${p.progress_percent ?? 0}%` }} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Budget {money(p.budget_total, p.currency)}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
