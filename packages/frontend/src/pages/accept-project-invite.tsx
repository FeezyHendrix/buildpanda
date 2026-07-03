import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { useAcceptProjectInvite, useProjectInvite } from "@/hooks/use-participants";
import { PENDING_PROJECT_INVITE_KEY } from "@/lib/route-guards";
import { authClient } from "@/lib/auth-client";
import logo from "@/assets/images/logo.svg";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AcceptProjectInvite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: invite, isLoading, isError } = useProjectInvite(token);
  const accept = useAcceptProjectInvite();

  // The session store can be stale right after signing in as a different
  // account (better-auth caches it in a cookie for up to 5 min), which made
  // emailMatches compare against the previous account and reject a valid
  // accept until the user refreshed. Force one fresh, cache-bypassing fetch on
  // mount so the mismatch decision is always made against the real account.
  useEffect(() => {
    void authClient.getSession({ query: { disableCookieCache: true } });
  }, []);

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

  async function switchAccount(): Promise<void> {
    if (token) localStorage.setItem(PENDING_PROJECT_INVITE_KEY, token);
    await authClient.signOut();
    navigate(
      `/auth/sign-in?redirect=${encodeURIComponent(`/accept-project-invite/${token}`)}`,
      { replace: true },
    );
  }

  useEffect(() => {
    if (sessionPending || !token || !signedIn || !invite || invite.expired) return;
    if (!emailMatches || accept.isPending || accept.isSuccess) return;
    handleAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPending, signedIn, token, invite, emailMatches]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-6">
      <Card padding="none" className="w-full max-w-xl p-8 sm:p-12 text-center">
        <img src={logo} alt="BuildPanda" className="mx-auto h-8 w-auto" />
        {isLoading ? (
          <p className="mt-8 text-sm text-gray-500">Loading invitation…</p>
        ) : isError || !invite ? (
          <p className="mt-8 text-sm text-gray-500">This invitation is invalid or has been withdrawn.</p>
        ) : invite.expired ? (
          <p className="mt-8 text-sm text-gray-500">This invitation has expired. Ask your builder to send a new one.</p>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Follow {invite.projectName}</h1>
              <p className="mt-2 text-sm text-gray-500">
                {invite.inviterName ? `${invite.inviterName} invited you` : "You've been invited"} to follow this build
                as the {invite.role}.
              </p>
            </div>
            {signedIn ? (
              emailMatches ? (
                <>
                  <Button variant="primary" size="lg" className="mt-2" loading={accept.isPending} onClick={handleAccept}>
                    Open my portal
                  </Button>
                  {accept.isError && (
                    <p className="text-sm text-red-600">
                      {(accept.error as Error).message ?? "Could not accept the invitation."}
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-2 flex flex-col gap-6 text-left">
                  <p className="text-sm text-gray-500 text-center">
                    This invitation was sent to <strong className="text-gray-900">{invite.email}</strong>, but you're signed
                    in as <strong className="text-gray-900">{sessionEmail}</strong>. You must continue as the invited account.
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => void switchAccount()}
                      className="group flex items-center gap-4 rounded-xl border border-[#EDEDED] p-4 text-left transition-colors hover:border-[#004DE7] hover:bg-[#F6F6F6]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#004DE7]/10 text-sm font-semibold text-[#004DE7]">
                        {session?.user?.name ? getInitials(session.user.name) : sessionEmail?.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-gray-900">{session?.user?.name || "Current Account"}</span>
                          <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Signed in</span>
                        </div>
                        <span className="truncate text-sm text-gray-500">{sessionEmail}</span>
                      </div>
                      <svg className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-[#004DE7] transition-colors" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                        <path d="M7.5 15L12.5 10L7.5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    <button
                      onClick={() => void switchAccount()}
                      className="group flex items-center gap-4 rounded-xl border border-[#EDEDED] p-4 text-left transition-colors hover:border-[#004DE7] hover:bg-[#F6F6F6]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 group-hover:bg-[#004DE7]/10 group-hover:text-[#004DE7] transition-colors">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm font-semibold text-gray-900">Use a different account</span>
                        <span className="text-sm text-gray-500">Sign in to {invite.email}</span>
                      </div>
                      <svg className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-[#004DE7] transition-colors" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                        <path d="M7.5 15L12.5 10L7.5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="mt-2 flex flex-col gap-3">
                <p className="text-sm text-gray-500">Sign in or create an account as <strong className="text-gray-900">{invite.email}</strong> to continue.</p>
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