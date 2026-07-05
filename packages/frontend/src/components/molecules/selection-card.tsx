import { Link } from "react-router-dom";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { AlertIcon } from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";
import { formatDayMonth, formatWholeCurrency } from "@/lib/formatters";
import type { Selection, SelectionOption, SelectionStatus } from "@/lib/project-types";

export const SELECTION_STATUS_META: Record<
  SelectionStatus,
  { tone: BadgeTone; label: string }
> = {
  open: { tone: "info", label: "Open" },
  decided: { tone: "success", label: "Decided" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

export function isSelectionOverdue(selection: Selection): boolean {
  return (
    selection.status === "open" &&
    Boolean(selection.dueDate) &&
    new Date(selection.dueDate as string).getTime() < Date.now()
  );
}

function money(amount: number, currency: string): string {
  return formatWholeCurrency(amount, currency);
}

interface OptionCardProps {
  option: SelectionOption;
  selection: Selection;
  selectable: boolean;
  onPick: (option: SelectionOption) => void;
}

function OptionCard({ option, selection, selectable, onPick }: OptionCardProps) {
  const isChosen = selection.chosenOptionId === option.id;
  const overAllowance =
    option.price !== null &&
    selection.allowanceAmount !== null &&
    option.price > selection.allowanceAmount;
  const overBy = overAllowance
    ? (option.price as number) - (selection.allowanceAmount as number)
    : 0;

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={() => onPick(option)}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
        isChosen
          ? "border-primary-500 bg-primary-50/50 ring-1 ring-primary-500"
          : "border-[#EDEDED] bg-white",
        selectable
          ? "cursor-pointer hover:border-primary-300"
          : "cursor-default",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-gray-900">
          {option.name}
        </span>
        {isChosen ? (
          <Badge tone="success" size="sm">
            ✓ Chosen
          </Badge>
        ) : null}
      </div>
      {option.description ? (
        <span className="line-clamp-2 text-xs text-gray-500">{option.description}</span>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900">
          {option.price === null ? "Price TBC" : money(option.price, selection.currency)}
        </span>
        {overAllowance ? (
          <Badge tone="warning" size="sm">
            ▲ {money(overBy, selection.currency)} over allowance
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

interface SelectionCardProps {
  selection: Selection;
  projectId: string;
  canManage: boolean;
  canDecide: boolean;
  onPickOption: (selection: Selection, option: SelectionOption) => void;
  onEdit: (selection: Selection) => void;
  onDelete: (selection: Selection) => void;
  onReopen: (selection: Selection) => void;
  onCreateChangeRequest: (selection: Selection) => void;
  creatingChangeRequest: boolean;
}

function SelectionCard({
  selection,
  projectId,
  canManage,
  canDecide,
  onPickOption,
  onEdit,
  onDelete,
  onReopen,
  onCreateChangeRequest,
  creatingChangeRequest,
}: SelectionCardProps) {
  const meta = SELECTION_STATUS_META[selection.status];
  const overdue = isSelectionOverdue(selection);
  const selectable = selection.status === "open" && canDecide;
  const chosen = selection.options.find((o) => o.id === selection.chosenOptionId);
  const showCreateChangeRequest =
    canManage &&
    selection.status === "decided" &&
    selection.changeRequestId === null &&
    selection.overage !== null &&
    selection.overage > 0;

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{selection.title}</p>
            <Badge tone={meta.tone} size="sm">
              {meta.label}
            </Badge>
            {selection.category ? (
              <Badge tone="neutral" size="sm">
                {selection.category}
              </Badge>
            ) : null}
            {overdue ? (
              <Badge tone="danger" size="sm">
                <AlertIcon className="size-3" aria-hidden="true" />
                Overdue
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {selection.allowanceAmount !== null ? (
              <span>Allowance {money(selection.allowanceAmount, selection.currency)}</span>
            ) : null}
            {selection.dueDate ? <span>Decide by {formatDayMonth(selection.dueDate)}</span> : null}
          </div>
          {selection.description ? (
            <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">{selection.description}</p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex shrink-0 items-center gap-3">
            {selection.status !== "open" ? (
              <button
                type="button"
                onClick={() => onReopen(selection)}
                className="text-xs font-medium text-gray-500 hover:text-gray-900"
              >
                Reopen
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onEdit(selection)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(selection)}
              className="text-xs font-medium text-red-500 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {selection.options.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {selection.options.map((option) => (
            <OptionCard
              key={option.id}
              option={option}
              selection={selection}
              selectable={selectable}
              onPick={(o) => onPickOption(selection, o)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No options added yet.</p>
      )}

      {selection.status === "decided" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F6F6F6] px-3 py-2">
          <p className="text-xs text-gray-600">
            {chosen ? (
              <>
                <span className="font-semibold text-gray-900">{chosen.name}</span> chosen
              </>
            ) : (
              "Decided"
            )}
            {selection.decidedByName ? ` by ${selection.decidedByName}` : ""}
            {selection.decidedAt ? ` on ${formatDayMonth(selection.decidedAt)}` : ""}
            {selection.overage !== null && selection.overage > 0
              ? ` — ${money(selection.overage, selection.currency)} over allowance`
              : ""}
          </p>
          {showCreateChangeRequest ? (
            <Button
              variant="primary"
              size="sm"
              loading={creatingChangeRequest}
              onClick={() => onCreateChangeRequest(selection)}
            >
              Create change request
            </Button>
          ) : null}
          {selection.changeRequestId !== null ? (
            <Link
              to={`/project/${projectId}/change-requests`}
              className="inline-flex items-center gap-1 rounded-full bg-[#E6EFFE] px-2.5 py-1 text-xs font-medium text-[#004DE7] hover:bg-[#d6e4fd]"
            >
              Change request created →
            </Link>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

SelectionCard.displayName = "SelectionCard";

export { SelectionCard };
