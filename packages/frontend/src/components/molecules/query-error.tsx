import { getApiErrorStatus } from "@/lib/api-error";
import { EmptyState } from "./empty-state";

interface Props {
  error: unknown;
  retry?: () => unknown;
  noun?: string;
}

export function QueryError({ error, retry, noun = "this information" }: Props) {
  const status = getApiErrorStatus(error);
  const forbidden = status === 403;
  const missing = status === 404;
  return <div role="alert">
    <EmptyState variant="inline"
      title={forbidden ? "Access required" : missing ? "Item unavailable" : `Could not load ${noun}`}
      description={forbidden ? "Ask your workspace administrator for access, or switch to the account that was invited."
        : missing ? "This item may have been removed. Return to the list to choose another item."
        : "We could not check the latest information. Your saved work has not been removed."}
      action={!forbidden && !missing && retry ? { label: "Try again", onClick: () => { void retry(); } } : undefined}
    />
  </div>;
}
QueryError.displayName = "QueryError";
