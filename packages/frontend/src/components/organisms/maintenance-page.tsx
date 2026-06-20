import logo from "@/assets/images/logo.svg";

const DEFAULT_MESSAGE =
  "We're making some improvements and will be back shortly. Thanks for your patience.";

export function MaintenancePage({ message }: { message?: string | null }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <img src={logo} alt="BuildPanda" className="h-9" />

        <div className="mt-10 flex size-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-500">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 8v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-black-500">We'll be right back</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-black-300">{message?.trim() || DEFAULT_MESSAGE}</p>
      </div>
    </main>
  );
}

MaintenancePage.displayName = "MaintenancePage";
