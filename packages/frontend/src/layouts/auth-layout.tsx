import { Outlet, Link, useLocation } from "react-router-dom";
import authBgOne from "@/assets/images/auth-bg-one.svg";
import authBgTwo from "@/assets/images/auth-bg-two.svg";
import logo from "@/assets/images/logo.svg";

const headerMap: Record<string, { text: string; linkText: string; to: string }> = {
  "/auth/sign-up": { text: "Already have an account?", linkText: "Sign In", to: "/auth/sign-in" },
  "/auth/sign-in": { text: "Don't have an account?", linkText: "Sign Up", to: "/auth/sign-up" },
  "/auth/forgot-password": { text: "Remember your password?", linkText: "Sign In", to: "/auth/sign-in" },
  "/auth/reset-password": { text: "Remember your password?", linkText: "Sign In", to: "/auth/sign-in" },
  "/auth/verify-email": { text: "Already verified?", linkText: "Sign In", to: "/auth/sign-in" },
};

const AUTH_BG_IMAGES = [authBgOne, authBgTwo] as const;

const CYCLE_DURATION_S = 24;

export default function AuthLayout() {
  const { pathname } = useLocation();
  const header = headerMap[pathname] ?? headerMap["/auth/sign-up"]!;

  return (
    <div className="flex h-dvh p-4">
      <div className="relative hidden w-[40%] shrink-0 overflow-hidden lg:block">
        {AUTH_BG_IMAGES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="absolute inset-0 size-full object-cover"
            style={{
              animation: `authBgFade ${CYCLE_DURATION_S}s ease-in-out infinite`,
              animationDelay: `${(CYCLE_DURATION_S / AUTH_BG_IMAGES.length) * i}s`,
              opacity: 0,
            }}
          />
        ))}
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

        <main className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
