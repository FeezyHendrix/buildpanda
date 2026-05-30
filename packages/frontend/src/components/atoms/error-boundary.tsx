import { Component, type ErrorInfo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ErrorBoundaryProps {
  fallback?: (error: Error, reset: () => void) => ReactNode;
  className?: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== "undefined") {
      console.error("ErrorBoundary caught:", error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    const { children, fallback, className } = this.props;

    if (!error) return children;
    if (fallback) return fallback(error, this.reset);

    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-10 text-center",
          className,
        )}
      >
        <h2 className="text-lg font-semibold text-gray-900">
          Something went wrong
        </h2>
        <p className="max-w-md text-sm text-gray-500 text-pretty">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-2 rounded-lg bg-[#004DE7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0041c4]"
        >
          Try again
        </button>
      </div>
    );
  }
}

export { ErrorBoundary, type ErrorBoundaryProps };
