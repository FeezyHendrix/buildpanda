import { Outlet, Link, useLocation } from "react-router-dom";
import authIllustration from "@/assets/images/auth-illustration.mp4";
import authIllustrationPoster from "@/assets/images/auth-illustration-poster.jpg";
import logo from "@/assets/images/logo.svg";
import logoWhite from "@/assets/images/logo-white.svg";

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
    <div className="flex h-dvh p-2 sm:p-4">
      {/* The v2 welcome panel: illustration, white logo, product line and the pitch. */}
      <div className="relative hidden w-1/2 shrink-0 overflow-hidden rounded-lg bg-[#0B1A3A] lg:flex">
        {/* the same animation as a video: a 20 MB GIF made every visitor wait */}
        <video
          className="absolute inset-0 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={authIllustrationPoster}
        >
          <source src={authIllustration} type="video/mp4" />
        </video>
        <div className="relative z-10 flex size-full flex-col justify-between p-12">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src={logoWhite} alt="BuildPanda" className="h-10" />
            </Link>
            <span className="rounded-lg bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm">The Construction OS</span>
          </div>
          <div className="flex max-w-[409px] flex-col gap-4">
            <h3 className="text-[48px] font-semibold leading-[56px] tracking-[-0.02em] text-white text-balance">
              Build it <span className="text-[#FFE607]">right</span>, from the ground up!
            </h3>
            <p className="text-base leading-6 tracking-[-0.02em] text-white">
              Set up your workspace in minutes then run projects, milestones, payments and inspections from one place
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:px-20 lg:py-8 px-2 py-2">
        <header className="flex items-center justify-between lg:pb-0 pb-4">
          <Link to="/">
            <img src={logo} alt="BuildPanda" className="h-9" />
          </Link>

          <p className="text-sm text-gray-500 text-pretty">
            {header.text}{" "}
            <Link
              to={header.to}
              className="font-semibold text-primary-500 hover:underline"
            >
              {header.linkText}
            </Link>
          </p>
        </header>

        <main className="flex-1 overflow-y-auto py-8 no-scrollbar">
          <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
