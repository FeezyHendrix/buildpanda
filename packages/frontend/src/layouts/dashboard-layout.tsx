import { Outlet, useNavigate } from "react-router-dom";
import { useSession } from "@/stores/auth";
import Navbar from "@/components/organisms/navbar";
import Sidebar from "@/components/organisms/sidebar";
import { useEffect } from "react";

export default function DashboardLayout() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/auth/sign-in", { replace: true });
    }
  }, [isPending, session, navigate]);

  if (isPending) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#004DE7]" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar
          user={{
            name: session.user.name,
            avatarUrl: session.user.image,
          }}
          notificationCount={0}
        />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
