import { signInPath } from "@/lib/return-path";
import { useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/stores/auth";

export function useAuthGuard() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isPending && !session) {
      navigate(signInPath(location.pathname + location.search + location.hash), { replace: true });
    }
  }, [isPending, session, navigate, location]);

  const logout = useCallback(async () => {
    await authClient.signOut();
    queryClient.clear();
    navigate("/auth/sign-in", { replace: true });
  }, [navigate, queryClient]);

  return { session, isPending, logout };
}
