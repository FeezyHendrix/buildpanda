import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { useAcceptProjectInvite, useProjectInvite } from "@/hooks/use-participants";
import { PENDING_PROJECT_INVITE_KEY } from "@/lib/route-guards";
import { authClient } from "@/lib/auth-client";
import logo from "@/assets/images/logo.svg";

export default function AcceptProjectInvite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: invite, isLoading, isError } = useProjectInvite(token);
  const accept = useAcceptProjectInvite();

  const signedIn = Boolean(session?.user);
  const sessionEmail = session?.user?.email?.toLowerCase() ?? null;
  const emailMatches =
    !invite || !sessionEmail || sessionEmail === invite.email.toLowerCase();

  useEffect(() => {
    if (sessionPending || !token) return;
    if (!signedIn) {
      localStorage.setItem(PENDING_PROJECT_INVITE_KEY, token);
    }
  }, [sessionPending, signedIn, token]);

  function handleAccept(): void {
    accept.mutate(token, {
      onSuccess: (res) => {
        localStorage.removeItem(PENDING_PROJECT_INVITE_KEY);
        navigate(`/project/${res.projectId}/overview`, { replace: true });
      },
    });
  }

  useEffect(() => {
    if (sessionPending || !token || !signedIn || !invite || invite.expired) return;
    if (!emailMatches || accept.isPending || accept.isSuccess) return;
    handleAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPending, signedIn, token, invite, emailMatches]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-6">
      <Card padding="lg" className="w-full max-w-md text-center">
        <img src={logo} alt="BuildPanda" className="mx-auto h-8 w-auto" />
        {isLoading ? (
          <p className="mt-6 text-sm text-gray-500">Loading invitation…</p>
        ) : isError || !invite ? (
          <p className="mt-6 text-sm text-gray-500">This invitation is invalid or has been withdrawn.</p>
        ) : invite.expired ? (
          <p className="mt-6 text-sm text-gray-500">This invitation has expired. Ask your builder to send a new one.</p>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Follow {invite.projectName}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {invite.inviterName ? `${invite.inviterName} invited you` : "You've been invited"} to follow this build
                as the {invite.role}.
              </p>
            </div>
            {signedIn ? (
              <>
                <Button variant="primary" size="lg" disabled={accept.isPending} onClick={handleAccept}>
                  {accept.isPending ? "Opening…" : "Open my portal"}
                </Button>
                {accept.isError && (
                  <p className="text-sm text-red-600">
                    {(accept.error as Error).message ?? "Could not accept the invitation."}
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-500">Sign in or create an account as {invite.email} to continue.</p>
                <Link to={`/auth/sign-up?email=${encodeURIComponent(invite.email)}&redirect=${encodeURIComponent(`/accept-project-invite/${token}`)}`}>
                  <Button variant="primary" size="lg" className="w-full">Create account</Button>
                </Link>
                <Link to={`/auth/sign-in?redirect=${encodeURIComponent(`/accept-project-invite/${token}`)}`} className="text-sm font-medium text-[#004DE7] hover:text-[#0041c4]">
                  I already have an account
                </Link>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
