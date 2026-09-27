import { AlertCircle, Check, Info } from "lucide-react";
import { Spinner } from "@/components/atoms/spinner";

interface SaveState {
  canPersist: boolean;
  isSaving: boolean;
  hasError: boolean;
  loadError: boolean;
  markupLoading: boolean;
}

/** Save feedback only; sheet identity and tools already have their own controls. */
export function PlanReviewStatusBar({ save }: { save: SaveState }) {
  const pending = save.isSaving || (save.canPersist && save.markupLoading);
  const label = save.loadError
    ? "Could not load annotations"
    : save.hasError
      ? "Could not save changes"
      : save.isSaving
        ? "Saving annotations…"
        : !save.canPersist
          ? "Demo plan — annotations are not saved"
          : save.markupLoading
            ? "Loading annotations…"
            : "Annotations saved";
  return (
    <footer
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center gap-1.5 border-t border-line-hair bg-white px-3 py-2 text-xs text-gray-500"
    >
      {save.hasError || save.loadError ? (
        <AlertCircle size={13} className="text-red-600" />
      ) : pending ? (
        <Spinner size="xs" />
      ) : save.canPersist ? (
        <Check size={13} className="text-green-600" />
      ) : (
        <Info size={13} />
      )}
      {label}
    </footer>
  );
}
PlanReviewStatusBar.displayName = "PlanReviewStatusBar";
