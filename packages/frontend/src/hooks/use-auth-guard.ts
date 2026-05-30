import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/stores/auth";

export function useAuthGuard() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/auth/sign-in", { replace: true });
    }
  }, [isPending, session, navigate]);

  const logout = useCallback(async () => {
    await authClient.signOut();
    navigate("/auth/sign-in", { replace: true });
  }, [navigate]);

  return { session, isPending, logout };
}
