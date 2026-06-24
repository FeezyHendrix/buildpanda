import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/stores/auth";

export function useAuthGuard() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/auth/sign-in", { replace: true });
    }
  }, [isPending, session, navigate]);

  const logout = useCallback(async () => {
    await authClient.signOut();
    queryClient.clear();
    navigate("/auth/sign-in", { replace: true });
  }, [navigate, queryClient]);

  return { session, isPending, logout };
}
