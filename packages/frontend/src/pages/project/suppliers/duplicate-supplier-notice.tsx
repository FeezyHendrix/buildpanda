import { Button } from "@/components/atoms/button";

interface DuplicateSupplierNoticeProps {
  message: string;
  /** False when the match sits outside the list this page loaded. */
  canOpen: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}

/**
 * "Ogun Quarries" and "Ogun Quarries Ltd" with the same phone number are one
 * account typed twice. The server refuses the second; this says which row it
 * matched so the user can open that one instead of creating a rival record.
 */
export function DuplicateSupplierNotice({
  message,
  canOpen,
  onOpen,
  onDismiss,
}: DuplicateSupplierNoticeProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-warning-500/40 bg-warning-50 p-3">
      <p className="text-sm font-semibold text-warning-500">This supplier already exists</p>
      <p className="text-sm text-ink text-pretty">{message}</p>
      <div className="flex flex-wrap gap-2">
        {canOpen ? (
          <Button type="button" variant="secondary" size="sm" onClick={onOpen}>
            Open the existing supplier
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Keep editing
        </Button>
      </div>
      <p className="text-xs text-ink-muted">
        Saving now adds a second account for the same contact details.
      </p>
    </div>
  );
}

DuplicateSupplierNotice.displayName = "DuplicateSupplierNotice";
