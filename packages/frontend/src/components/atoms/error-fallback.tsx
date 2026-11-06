import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusPage, STATUS_ACTION_OUTLINE, STATUS_ACTION_PRIMARY } from "@/components/molecules/status-page";

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const navigate = useNavigate();

  return (
    <StatusPage
      lead="Oops, something broke"
      emphasis="fixing it right away!"
      description="An unexpected error stopped this page from loading, try reloading. If it keeps happening, go back to your dashboard"
      actions={
        <>
          <button type="button" onClick={() => navigate("/dashboard")} className={STATUS_ACTION_OUTLINE}>
            Back to Dashboard
          </button>
          <button type="button" onClick={reset} className={STATUS_ACTION_PRIMARY}>
            Reload Page
          </button>
        </>
      }
      footer={
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-[12px] text-[#888888] underline underline-offset-2 hover:text-[#606060]"
          >
            {showDetails ? "Hide error details" : "Show error details"}
          </button>
          {showDetails && (
            <pre className="mt-3 max-w-md bg-[#F8F8F8] px-4 py-3 text-left font-mono text-[11px] leading-relaxed text-[#606060] whitespace-pre-wrap break-all">
              {error.message || "Unknown error"}
            </pre>
          )}
        </div>
      }
    />
  );
}

ErrorFallback.displayName = "ErrorFallback";

export { ErrorFallback, type ErrorFallbackProps };
