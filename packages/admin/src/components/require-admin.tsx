import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { adminApi } from "@/api/admin";
import { Loading, Card, Button } from "@/components/ui";
import { ShieldIcon } from "@/components/icons";

export function RequireAdmin() {
  const { data: session, isPending } = authClient.useSession();
  const loggedIn = !!session?.user;

  // Verify admin access against the backend rather than the cached session role
  // (better-auth's cookie cache can briefly hold a pre-promotion role).
  const me = useQuery({
    queryKey: ["admin", "me"],
    queryFn: adminApi.me,
    enabled: loggedIn,
    retry: false,
  });

  if (isPending || (loggedIn && me.isPending)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loading label="Checking access" />
      </div>
    );
  }

  if (!loggedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  if (me.isError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="flex max-w-md flex-col items-center gap-4 p-10 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
            <ShieldIcon className="h-7 w-7" />
          </span>
          <h1 className="text-xl font-bold text-ink">Access denied</h1>
          <p className="text-sm text-muted">
            This account ({session?.user?.email}) is not a platform administrator.
            Ask an existing admin to grant you access, or sign in with an admin
            account.
          </p>
          <Button variant="secondary" onClick={() => authClient.signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
