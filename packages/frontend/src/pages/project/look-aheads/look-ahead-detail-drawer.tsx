import { Dialog } from "@base-ui/react/dialog";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import type { LookAhead } from "@/lib/project-types";
import { formatLookAheadDate, LOOK_AHEAD_STATUS_META } from "./look-ahead-helpers";

interface LookAheadDetailDrawerProps {
  open: boolean;
  lookAhead: LookAhead | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (lookAhead: LookAhead) => void;
}

export function LookAheadDetailDrawer({
  open,
  lookAhead,
  canManage,
  onOpenChange,
  onEdit,
}: LookAheadDetailDrawerProps) {
  if (!lookAhead) return null;
  const status = LOOK_AHEAD_STATUS_META[lookAhead.status];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(520px,100vw)] flex-col bg-white shadow-xl outline-none",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
          )}
        >
          <header className="border-b border-[#F0F0F0] px-6 py-5">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {lookAhead.name}
            </Dialog.Title>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={status.tone} size="md">{status.label}</Badge>
              <span className="text-sm text-gray-500">
                {formatLookAheadDate(lookAhead.startDate)} - {formatLookAheadDate(lookAhead.endDate)}
              </span>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Details</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Metric label="Manpower" value={lookAhead.totalWorkers != null ? String(lookAhead.totalWorkers) : "Not set"} />
                <Metric label="Activities" value={String(lookAhead.activities.length)} />
              </div>
              {lookAhead.description && (
                <p className="mt-4 rounded-xl bg-[#F8F8F8] p-4 text-sm leading-6 text-gray-700">
                  {lookAhead.description}
                </p>
              )}
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Activities</p>
              {lookAhead.activities.length === 0 ? (
                <p className="mt-3 rounded-xl bg-[#F8F8F8] p-4 text-sm text-gray-500">No activities attached yet.</p>
              ) : (
                <div className="mt-3 flex flex-col divide-y divide-[#EDEDED] rounded-xl border border-[#EDEDED]">
                  {lookAhead.activities.map((activity) => (
                    <div key={activity.activityId} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{activity.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {formatLookAheadDate(activity.plannedStartAt.slice(0, 10))} - {formatLookAheadDate(activity.plannedEndAt.slice(0, 10))}
                        </p>
                      </div>
                      <Badge tone="neutral" size="sm">{activity.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-[#F0F0F0] px-6 py-4">
            <Dialog.Close render={<Button type="button" variant="secondary" size="sm">Close</Button>} />
            {canManage && (
              <Button type="button" size="sm" onClick={() => onEdit(lookAhead)}>
                Edit look ahead
              </Button>
            )}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#EDEDED] bg-white p-3">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}
