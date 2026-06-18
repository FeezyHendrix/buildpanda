import { useState } from "react";
import { Dialog } from "@base-ui-components/react/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import type { Activity, ActivityStatus } from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";

// ── Status meta ───────────────────────────────────────────────────────────────
const STATUS_META: Record<
  ActivityStatus,
  { label: string; tone: "neutral" | "info" | "success" | "danger" }
> = {
  Planned:    { label: "Planned",     tone: "neutral"  },
  InProgress: { label: "In Progress", tone: "info"     },
  Completed:  { label: "Completed",    tone: "success"  },
  Cancelled:  { label: "Cancelled",   tone: "danger"   },
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div className="relative flex size-24 shrink-0 items-center justify-center">
      <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#F0F0F0" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r}
          fill="none" stroke="#004DE7" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[15px] font-bold text-gray-900">{pct}%</span>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, className }: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-[#F0F0F0] pt-4 mt-4", className)}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#F8F8F8] last:border-0">
      <span className="text-[13px] text-gray-500">{label}</span>
      <span className="text-[13px] font-medium text-gray-900">{value}</span>
    </div>
  );
}

// ── Stub photo thumbnails ─────────────────────────────────────────────────────
const PHOTO_COLORS = ["#E8F0FF", "#FFF3DE", "#E0FFFC", "#F4EEFF", "#FFE6F0"];

function PhotoGrid() {
  return (
    <div className="grid grid-cols-5 gap-2">
      {PHOTO_COLORS.map((bg, i) => (
        <div
          key={i}
          style={{ backgroundColor: bg }}
          className="aspect-square rounded-lg flex items-center justify-center text-[10px] text-gray-400"
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
interface ActivityDetailModalProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivityDetailModal({ activity, open, onOpenChange }: ActivityDetailModalProps) {
  const [message, setMessage] = useState("");

  const progressPct =
    activity?.status === "Completed"  ? 100 :
    activity?.status === "InProgress" ? 70  : 0;

  const meta = activity ? STATUS_META[activity.status] : null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 px-6 py-5",
            "flex w-full max-w-[1142px] h-[95vh] flex-col",
            "rounded-[16px] bg-white shadow-xl outline-none",
          )}
        >
          {!activity || !meta ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <>
              {/* ── Header ── */}
              <div className="flex items-start justify-between border-b border-[#F0F0F0]">
                <div>
                  <p className="text-[16px] font-bold text-gray-900">{activity.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge tone={meta.tone} size="sm">{meta.label}</Badge>
                    {activity.location && (
                      <span className="text-[12px] text-gray-400">{activity.location}</span>
                    )}
                  </div>
                </div>
                <Dialog.Close
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-[#F6F6F6] hover:text-gray-700"
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </Dialog.Close>
              </div>

              <div className='flex items-center justify-between p-4 bg-[#F6F6F6] border border-[#F6F6F6] rounded-[10px]'>
                <div className='flex items-center gap-2'>
                  <ProgressRing pct={activity.percentComplete} />
                  <div>
                    <p className="text-[13px] tabular-nums text-black-500 font-semibold">Latest Update</p>
                    <p className='text-[#434655] text-[13px]'>{activity.notes || 'N/A'}</p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  // onClick={() => setRequestOpen(true)}
                  className="h-[32px] cursor-pointer hover:bg-primary text-[13px] font-semibold px-[20px] py-[12px]"
                >
                  <ReactSVG src={icons.plusCircle} />
                  Request New Inspection
                </Button>
              </div>

              {/* ── Scrollable two-column body ── */}
              <div className="flex flex-1 overflow-hidden">

                {/* Left column */}
                <div className="flex w-1/2 flex-col overflow-y-auto border-r border-[#F0F0F0]">
                  <Section title="Progress Photos">
                    <PhotoGrid />
                  </Section>

                  <Section title="Activity Schedule">
                    <InfoRow label="Planned Start" value={fmt(activity.plannedStartAt)} />
                    <InfoRow label="Planned End"   value={fmt(activity.plannedEndAt)} />
                    <InfoRow label="Actual Start"  value={fmt(activity.actualStartAt)} />
                    <InfoRow label="Actual End"    value={fmt(activity.actualEndAt)} />
                    <InfoRow label="Workers"       value={String(activity.workerCountPlanned)} />
                  </Section>

                  <div className="border-t border-[#F0F0F0]">
                <div className="flex items-center gap-3 rounded-[10px] border border-[#EDEDED] bg-[#FAFAFA] px-4 py-2.5">
                  <input
                    className="flex-1 bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 outline-none"
                    placeholder="Write a message or note…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && message.trim()) setMessage(""); }}
                  />
                  <button
                    type="button"
                    disabled={!message.trim()}
                    className="shrink-0 rounded-lg bg-[#004DE7] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
                    onClick={() => setMessage("")}
                  >
                    Send
                  </button>
                </div>
              </div>
                </div>

                {/* Right column */}
                <div className="flex w-1/2 flex-col overflow-y-auto px-6 py-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Site Issues</p>
                    <div className="mt-3">
                      {activity.delays.length === 0 ? (
                        <p className="text-[13px] text-gray-400">No issues logged.</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {activity.delays.map((d) => (
                            <li key={d.id} className="rounded-lg bg-[#FFF5F5] px-3 py-2.5">
                              <p className="text-[12px] font-semibold text-red-600">{d.reasonCode}</p>
                              <p className="mt-0.5 text-[12px] text-gray-600">{d.description ?? "—"}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <Section title="Messages">
                    <p className="text-[13px] text-gray-400">No messages yet.</p>
                  </Section>

                  <Section title="Financial Details">
                    <InfoRow label="Activity Type" value={activity.activityType} />
                    {activity.delays.some((d) => d.costImpact) && (
                      <InfoRow
                        label="Delay Cost Impact"
                        value={`₦${activity.delays
                          .filter((d) => d.costImpact)
                          .reduce((s, d) => s + (d.costImpact ?? 0), 0)
                          .toLocaleString()}`}
                      />
                    )}
                  </Section>

                  <Section title="Potential Log">
                    <p className="text-[13px] text-gray-400">No entries logged.</p>
                  </Section>
                </div>
              </div>

              {/* ── Footer: send message ── */}
              
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
