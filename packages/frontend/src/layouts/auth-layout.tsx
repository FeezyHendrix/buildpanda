import { Outlet, Link, useLocation } from "react-router-dom";
import authBg from "@/assets/images/auth-bg.mp4";
import authBgPoster from "@/assets/images/auth-bg-poster.jpg";
import logo from "@/assets/images/logo.svg";

const headerMap: Record<string, { text: string; linkText: string; to: string }> = {
  "/auth/sign-up": { text: "Already have an account?", linkText: "Sign In", to: "/auth/sign-in" },
  "/auth/sign-in": { text: "Don't have an account?", linkText: "Sign Up", to: "/auth/sign-up" },
  "/auth/forgot-password": { text: "Remember your password?", linkText: "Sign In", to: "/auth/sign-in" },
  "/auth/reset-password": { text: "Remember your password?", linkText: "Sign In", to: "/auth/sign-in" },
  "/auth/verify-email": { text: "Already verified?", linkText: "Sign In", to: "/auth/sign-in" },
};

export default function AuthLayout() {
  const { pathname } = useLocation();
  const header = headerMap[pathname] ?? headerMap["/auth/sign-up"]!;

  return (
    <div className="flex h-dvh p-4">
      <div className="relative hidden w-[40%] shrink-0 overflow-hidden rounded-2xl bg-white lg:block">
        <video
          className="absolute inset-0 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={authBgPoster}
        >
          <source src={authBg} type="video/mp4" />
        </video>
      </div>

      <div className="flex flex-1 flex-col px-6 py-8 sm:px-12 lg:px-20">
        <header className="flex items-center justify-between">
          <Link to="/">
            <img src={logo} alt="BuildPanda" className="h-9" />
          </Link>

          <p className="text-sm text-gray-500 text-pretty">
            {header.text}{" "}
            <Link
              to={header.to}
              className="font-semibold text-[#004DE7] hover:underline"
            >
              {header.linkText}
            </Link>
          </p>
        </header>

        <main className="flex-1 overflow-y-auto py-8">
          <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
