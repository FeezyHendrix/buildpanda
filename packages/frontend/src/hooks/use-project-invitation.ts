import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { PENDING_PROJECT_INVITE_KEY } from "@/lib/route-guards";
import { signInPath } from "@/lib/return-path";
import { useAcceptProjectInvite, useProjectInvite } from "./use-participants";

function rememberInvite(token: string | null) {
  try {
    if (token) localStorage.setItem(PENDING_PROJECT_INVITE_KEY, token);
    else localStorage.removeItem(PENDING_PROJECT_INVITE_KEY);
  } catch { /* The return URL also carries the invitation. */ }
}

export function useProjectInvitation(token: string) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const preview = useProjectInvite(token);
  const accept = useAcceptProjectInvite();
  const attempted = useRef<string | null>(null);
  const destination = `/accept-project-invite/${token}`;
  // Confirm the actual account before accepting; cookie-cached identity can
  // belong to the account the user just signed out of.
  const session = useQuery({
    queryKey: ["invitation-session", token],
    queryFn: async () => {
      const result = await authClient.getSession({ query: { disableCookieCache: true } });
      if (result.error) throw new Error(result.error.message ?? "Could not check your account.");
      return result.data;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const user = session.data?.user;
  const emailMatches = Boolean(user && preview.data && user.email.toLowerCase() === preview.data.email.toLowerCase());
  const ready = session.isSuccess && !session.isFetching && preview.isSuccess && !preview.isFetching;
  const eligible = ready && emailMatches && !preview.data?.expired;

  function join() {
    if (!eligible || accept.isPending || accept.isSuccess) return;
    accept.mutate(token, {
      onSuccess: result => {
        rememberInvite(null);
        navigate(`/project/${result.projectId}/overview`, { replace: true });
      },
    });
  }

  const switchAccount = useMutation({
    mutationFn: async () => {
      rememberInvite(token);
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message ?? "Could not switch accounts.");
    },
    onSuccess: () => {
      qc.clear();
      navigate(signInPath(destination), { replace: true });
    },
  });

  useEffect(() => {
    if (ready && !user) rememberInvite(token);
  }, [ready, user?.id, token]);

  useEffect(() => {
    const identity = `${token}:${user?.id}`;
    if (!eligible || attempted.current === identity) return;
    attempted.current = identity;
    join();
    // Automatic acceptance runs once per invite/account. A failure leaves a
    // visible retry; query refreshes must not submit it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, token, user?.id]);

  return { preview, session, user, emailMatches, join, accept, switchAccount, destination };
}
