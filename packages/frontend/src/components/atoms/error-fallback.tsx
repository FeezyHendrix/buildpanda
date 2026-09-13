import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/images/logo.svg";

function ConstructionErrorIllustration() {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Ground / base */}
      <rect x="20" y="118" width="160" height="6" rx="3" fill="#E6EDFD" />

      {/* Building — left section standing */}
      <rect x="28" y="62" width="48" height="56" rx="3" fill="#E6EDFD" stroke="#B0C8F8" strokeWidth="1" />
      <rect x="36" y="72" width="12" height="14" rx="1.5" fill="#B0C8F8" />
      <rect x="56" y="72" width="12" height="14" rx="1.5" fill="#B0C8F8" />
      <rect x="36" y="94" width="12" height="14" rx="1.5" fill="#B0C8F8" />
      <rect x="56" y="94" width="12" height="14" rx="1.5" fill="#B0C8F8" />

      {/* Building — right section crumbled / tilted */}
      <g transform="translate(106,50) rotate(8)">
        <rect width="52" height="62" rx="3" fill="#E6EDFD" stroke="#B0C8F8" strokeWidth="1" />
        <rect x="8" y="10" width="12" height="14" rx="1.5" fill="#B0C8F8" />
        <rect x="28" y="10" width="12" height="14" rx="1.5" fill="#B0C8F8" />
        <rect x="8" y="32" width="12" height="14" rx="1.5" fill="#B0C8F8" />
        <rect x="28" y="32" width="12" height="14" rx="1.5" fill="#B0C8F8" />
      </g>

      {/* Crack / split line between buildings */}
      <path
        d="M82 118 L86 100 L80 88 L88 72 L84 58"
        stroke="#004DE7"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 3"
      />

      {/* Falling debris */}
      <rect x="90" y="50" width="10" height="8" rx="2" fill="#B0C8F8" transform="rotate(-20 95 54)" />
      <rect x="146" y="110" width="14" height="6" rx="2" fill="#B0C8F8" transform="rotate(15 153 113)" />
      <rect x="16" y="108" width="8" height="6" rx="2" fill="#B0C8F8" transform="rotate(-10 20 111)" />

      {/* Alert circle */}
      <circle cx="100" cy="30" r="22" fill="#004DE7" />
      <circle cx="100" cy="30" r="22" fill="url(#errGrad)" />
      <defs>
        <linearGradient id="errGrad" x1="100" y1="8" x2="100" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3121C1" />
          <stop offset="100%" stopColor="#004DE7" />
        </linearGradient>
      </defs>
      <text
        x="100"
        y="37"
        textAnchor="middle"
        fill="white"
        fontSize="22"
        fontWeight="bold"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        !
      </text>

      {/* Hard hat — left worker */}
      <ellipse cx="42" cy="56" rx="14" ry="6" fill="#004DE7" />
      <rect x="36" y="51" width="12" height="6" rx="3" fill="#3121C1" />
      <rect x="28" y="56" width="28" height="3" rx="1.5" fill="#0037A4" />
    </svg>
  );
}

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-2">
        <img src={logo} alt="Build Panda" className="h-7" />
      </div>

      {/* Illustration */}
      <ConstructionErrorIllustration />

      {/* Copy */}
      <div className="mt-6 max-w-sm text-center">
        <h1 className="text-[22px] font-semibold text-[#131B2E]">
          Something broke on site
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#606060]">
          An unexpected error stopped this page from loading. Try reloading
          if it keeps happening, head back to your dashboard.
        </p>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-[10px] px-5 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(to bottom, #3121C1, #004DE7)" }}
        >
          Reload page
        </button>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="rounded-[10px] border border-[#EBEBEB] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#131B2E] transition-colors hover:bg-[#F8F8F8] active:scale-95"
        >
          Go to dashboard
        </button>
      </div>

      {/* Collapsible error details */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="text-[12px] text-[#888888] underline underline-offset-2 hover:text-[#606060]"
        >
          {showDetails ? "Hide error details" : "Show error details"}
        </button>
        {showDetails && (
          <pre className="mt-3 max-w-md rounded-xl bg-[#F8F8F8] px-4 py-3 text-left font-mono text-[11px] leading-relaxed text-[#606060] whitespace-pre-wrap break-all">
            {error.message || "Unknown error"}
          </pre>
        )}
      </div>
    </div>
  );
}

ErrorFallback.displayName = "ErrorFallback";

export { ErrorFallback, type ErrorFallbackProps };
