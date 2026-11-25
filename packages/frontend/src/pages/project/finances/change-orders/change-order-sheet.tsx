import { Dialog } from "@base-ui/react/dialog";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { ChangeRequestActions } from "@/components/molecules/change-request-actions";
import { ChangeRequestBudgetAllocations } from "@/components/molecules/change-request-budget-allocations";
import { ChangeClaimDelays } from "@/components/molecules/change-request-context";
import { CHANGE_STATUS_META, ReasonValue } from "@/components/molecules/change-request-detail-dialog";
import { useChangeRequest } from "@/hooks/use-change-requests";
import { CONTRACTS_PHASES_PATH } from "@/lib/finance-routes";
import { formatLongDate, formatWholeCurrency } from "@/lib/formatters";
import type { ChangeRequestDetail } from "@/lib/project-types";
import { ChangeOrderDiscussion } from "./change-order-discussion";
import { typeLabel } from "./change-order-model";

function Heading({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <h3 className={muted ? "text-[16px] font-medium leading-[24px] text-[#737373]" : "text-[16px] font-semibold leading-[24px] text-[#1E1E1E]"}>{children}</h3>;
}

/** What the change hangs off: the stage whose dates move, the RFI it answers, the contract it produced. */
function LinkedRecords({ cr, projectId }: { cr: ChangeRequestDetail; projectId: string }) {
  const base = `/project/${projectId}`;
  const links: { label: string; to: string }[] = [];
  if (cr.stageId) links.push({ label: "Affected stage", to: `${base}/stages` });
  if (cr.rfiId) links.push({ label: "Originating RFI", to: `${base}/rfis` });
  if (cr.contractId) links.push({ label: "Change order contract", to: `${base}/${CONTRACTS_PHASES_PATH}?drawer=${encodeURIComponent(cr.contractId)}` });
  if (links.length === 0) return null;
  return (
    <section className="flex flex-col gap-[16px]">
      <Heading muted>Linked records</Heading>
      <ul className="flex flex-wrap gap-[8px]">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              to={link.to}
              className="inline-flex h-[40px] items-center gap-[8px] border border-[#E0E0E0] bg-white px-[12px] text-caption-l font-medium text-[#1E1E1E] outline-none hover:bg-[#F6F6F6] focus-visible:ring-2 focus-visible:ring-[#004DE7]/25"
            >
              {link.label}
              <ChevronRight className="size-[16px]" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

LinkedRecords.displayName = "LinkedRecords";

/** The negotiation, version by version: what was asked, by whom, and what was decided. */
function Revisions({ cr }: { cr: ChangeRequestDetail }) {
  const revisions = cr.revisions ?? [];
  if (revisions.length === 0) return null;
  return (
    <section className="flex flex-col gap-[16px]">
      <Heading>Revisions ({revisions.length})</Heading>
      <ol className="flex flex-col gap-[16px]">
        {revisions.map((revision) => (
          <li key={revision.version}>
            <div className="flex items-start justify-between gap-[16px]">
              <p className="text-caption-l leading-[20px] tabular-nums text-[#1E1E1E]">
                v{revision.version} · {formatWholeCurrency(revision.costImpact, cr.currency)}
                {revision.timeImpactDays > 0 ? ` · +${revision.timeImpactDays} days` : ""}
              </p>
              <p className="shrink-0 pt-[2px] text-caption-m text-[#737373]">
                {revision.status} · {formatLongDate(revision.at)}
              </p>
            </div>
            <p className="mt-[4px] text-caption-m text-[#737373]">by {revision.actorName}</p>
            {revision.reason ? <p className="mt-[8px] text-caption-m text-[#1E1E1E] text-pretty">{revision.reason}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

Revisions.displayName = "Revisions";

interface ChangeOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  changeId: string | null;
  canManage: boolean;
}

/**
 * One change order, read in full. Its decisions (submit, approve, reject,
 * execute) sit in the header, so each one carries its reason, actor and date;
 * Cancel only closes the sheet.
 */
export function ChangeOrderSheet({ open, onOpenChange, projectId, changeId, canManage }: ChangeOrderSheetProps) {
  const { data: cr, isLoading } = useChangeRequest(projectId, changeId ?? undefined);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-300 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-[min(698px,100vw)] flex-col bg-white shadow-drawer outline-none transition-transform duration-300 ease-out data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full">
          {isLoading || !cr ? (
            <div className="flex flex-1 items-center justify-center">
              <Dialog.Title className="sr-only">Change order</Dialog.Title>
              <Spinner size="md" />
            </div>
          ) : (
            <Loaded cr={cr} projectId={projectId} canManage={canManage} />
          )}
          <footer className="flex justify-end px-[24px] pb-[24px] pt-[16px]">
            <Dialog.Close
              render={
                <Button type="button" variant="outline" size="lg" className="h-[46px] w-[194px] border border-[#E0E0E0]">
                  Cancel
                </Button>
              }
            />
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

ChangeOrderSheet.displayName = "ChangeOrderSheet";

function Loaded({ cr, projectId, canManage }: { cr: ChangeRequestDetail; projectId: string; canManage: boolean }) {
  const meta = CHANGE_STATUS_META[cr.status];
  const noRevisions = (cr.revisions ?? []).length === 0;

  return (
    <>
      <header className="flex items-start justify-between gap-[16px] px-[24px] pb-[24px] pt-[39px]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[6px]">
            <Dialog.Title className="text-[20px] font-semibold leading-[28px] text-[#1E1E1E]">{cr.title}</Dialog.Title>
            <Badge tone={meta.tone} size="md" className="h-[24px] text-caption-m font-semibold">
              {meta.label}
            </Badge>
            <Badge tone="neutral" size="md" className="h-[24px] bg-white text-caption-m font-medium">
              {typeLabel(cr.type)}
            </Badge>
          </div>
          {cr.description ? <Dialog.Description className="mt-[6px] max-w-[340px] text-caption-m text-[#737373] text-pretty">{cr.description}</Dialog.Description> : null}
        </div>
        {canManage ? (
          <div className="mt-[14px] shrink-0">
            <ChangeRequestActions projectId={projectId} cr={cr} appearance="sheet" />
          </div>
        ) : null}
      </header>
      <div aria-hidden className="mx-[24px] h-px shrink-0 bg-[#EEEEEE]" />

      <div className="flex flex-1 flex-col gap-[24px] overflow-y-auto px-[24px] pb-[24px] pt-[24px] no-scrollbar">
        <LinkedRecords cr={cr} projectId={projectId} />

        {noRevisions && cr.reason ? (
          <section className="flex flex-col gap-[16px]">
            <Heading>Reason</Heading>
            <ReasonValue cr={cr} />
          </section>
        ) : null}

        <ChangeClaimDelays cr={cr} />
        <Revisions cr={cr} />
        {cr.rejectedReason ? (
          <div className="border border-[#FFC9C9] bg-[#FEF2F2] p-3">
            <p className="text-caption-m font-semibold text-[#C10007]">Rejected{cr.decidedByName ? ` by ${cr.decidedByName}` : ""}</p>
            <p className="mt-0.5 text-caption-l text-[#1E1E1E] text-pretty">{cr.rejectedReason}</p>
          </div>
        ) : null}

        <ChangeOrderDiscussion projectId={projectId} cr={cr} />
        {cr.costImpact > 0 ? <ChangeRequestBudgetAllocations projectId={projectId} cr={cr} /> : null}
      </div>
    </>
  );
}

Loaded.displayName = "Loaded";
