import { useNavigate } from "react-router-dom";
import { useMyOrgRole } from "@/hooks/use-organization";
import {
  useDataCommitment,
  useAcceptDataCommitment,
} from "@/hooks/use-data-commitment";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/atoms/button";

export function DataCommitmentGate() {
  const { data: session } = authClient.useSession();
  const role = useMyOrgRole();
  // "owner" = the company/workspace owner (better-auth member.role), NOT a
  // project client. Exclude project_owner accounts so the client never sees it.
  const accountType = (session?.user as { accountType?: string | null } | undefined)?.accountType ?? null;
  const isWorkspaceOwner = role === "owner" && accountType !== "project_owner";

  const { data: status, isPending } = useDataCommitment(isWorkspaceOwner);
  const accept = useAcceptDataCommitment();
  const navigate = useNavigate();

  const shouldShow = isWorkspaceOwner && !isPending && status && status.accepted === false;

  if (!shouldShow) {
    return null;
  }

  const handleLogout = async () => {
    await authClient.signOut();
    navigate("/auth/sign-in");
  };

  const handleAccept = () => {
    accept.mutate();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[calc(100dvh-2rem)]">
        <header className="px-8 pt-8">
          <h2 className="text-xl font-bold text-gray-900">
            Your data is yours. Here's our commitment.
          </h2>
          <p className="mt-2 text-sm text-gray-600 text-pretty">
            Before you continue, please review how BuildPanda protects your workspace's data.
          </p>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto px-8 py-6">
          <ul className="flex flex-col gap-4 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="shrink-0 mt-0.5 text-blue-600">•</span>
              <span>
                <strong className="font-semibold text-gray-900">We never sell your data.</strong> — Your leads, drawings, budgets, invoices and site records are never sold, rented, or shared with data brokers or advertisers.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 mt-0.5 text-blue-600">•</span>
              <span>
                <strong className="font-semibold text-gray-900">It's encrypted.</strong> — Your data is encrypted in transit, and your uploaded files are encrypted at rest.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 mt-0.5 text-blue-600">•</span>
              <span>
                <strong className="font-semibold text-gray-900">Your files stay private.</strong> — Documents are served only through short-lived private links, never left open to the public web.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 mt-0.5 text-blue-600">•</span>
              <span>
                <strong className="font-semibold text-gray-900">Your data is walled off.</strong> — Strict access controls keep each organization's data separate. Only people you invite, with the access you grant, can see it.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 mt-0.5 text-blue-600">•</span>
              <span>
                <strong className="font-semibold text-gray-900">You stay in control.</strong> — You decide who joins your workspace and exactly what each person can see or edit.
              </span>
            </li>
          </ul>
        </div>

        <div className="px-8 pb-6">
          <p className="text-xs text-gray-500">
            By continuing you agree to our <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy</a> and <a href="/dpa" className="underline hover:text-gray-700">Data Processing Agreement</a>.
          </p>
        </div>

        {accept.error && (
          <div className="px-8 pb-4">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {accept.error instanceof Error ? accept.error.message : "Failed to accept the commitment. Please try again."}
            </p>
          </div>
        )}

        <footer className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-8 py-5">
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={handleLogout}
              disabled={accept.isPending}
            >
              Log out
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              onClick={handleAccept}
              disabled={accept.isPending}
            >
              {accept.isPending ? "Saving..." : "Agree & continue"}
            </Button>
          </div>
          <p className="text-center text-[11px] text-gray-500">
            Accepted on behalf of your workspace by the owner.
          </p>
        </footer>
      </div>
    </div>
  );
}

DataCommitmentGate.displayName = "DataCommitmentGate";
