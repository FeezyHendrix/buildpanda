import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { ChangeRequestActions } from "@/components/molecules/change-request-actions";
import { CHANGE_STATUS_META, CHANGE_STATUS_PILL as STATUS_PILL } from "@/components/molecules/change-request-detail-dialog";
import { ChangeTypeBadge } from "@/components/molecules/change-request-context";
import { formatWholeCurrency } from "@/lib/formatters";
import type { ChangeRequest } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { ContractChip } from "./contract-chip";

/**
 * One row of the change-request register.
 *
 * A time claim reads differently from a variation and must: it has no money,
 * so showing ₦0 tells a QS nothing, while the days claimed against the days
 * awarded is the whole negotiation — "14 claimed, 9 awarded" is the record of
 * what the engineer actually granted.
 */
interface ChangeRowProps {
  cr: ChangeRequest;
  projectId: string;
  canManage: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ICON_BUTTON =
  "flex size-[24px] items-center justify-center border border-[#EEEEEE] bg-white text-[#1E1E1E] outline-none hover:bg-[#F5F5F5] focus-visible:ring-2 focus-visible:ring-gray-900/10 [&_svg]:size-[14px]";

function Divider() {
  return <span aria-hidden className="h-[16px] w-px bg-[#1E1E1E]" />;
}

function TimeClaimFigures({ cr }: { cr: ChangeRequest }) {
  return (
    <>
      <span className="font-semibold tabular-nums">
        {cr.timeImpactDays} {cr.timeImpactDays === 1 ? "day" : "days"} claimed
      </span>
      <Divider />
      <span className="tabular-nums">
        {cr.daysAwarded === null
          ? "Not yet awarded"
          : `${cr.daysAwarded} ${cr.daysAwarded === 1 ? "day" : "days"} awarded`}
      </span>
      {cr.delays.length > 0 ? (
        <>
          <Divider />
          <span>
            {cr.delays.length} {cr.delays.length === 1 ? "delay" : "delays"} cited
          </span>
        </>
      ) : null}
    </>
  );
}

TimeClaimFigures.displayName = "TimeClaimFigures";

export function ChangeRow({ cr, projectId, canManage, onOpen, onEdit, onDelete }: ChangeRowProps) {
  const meta = CHANGE_STATUS_META[cr.status];

  return (
    <article className="relative border-b border-[#EEEEEE] px-[24px] pb-[24px] pt-[24px] last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full pr-[64px] text-left outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        <div className="flex flex-wrap items-center gap-[8px]">
          <span
            className={cn(
              "inline-flex h-[22px] items-center rounded-full border px-[8px] text-[12px] font-medium leading-[16px]",
              STATUS_PILL[cr.status],
            )}
          >
            {meta.label}
          </span>
          <ChangeTypeBadge type={cr.type} />
          {cr.contractId ? <ContractChip projectId={projectId} contractId={cr.contractId} /> : null}
        </div>
        <p className="mt-[14px] truncate text-[14px] font-semibold leading-[20px] text-[#1E1E1E]">{cr.title}</p>
        {cr.description ? <p className="mt-[4px] truncate text-[14px] leading-[20px] text-[#1E1E1E]">{cr.description}</p> : null}
        <div className="mt-[4px] flex flex-wrap items-center gap-[8px] text-[14px] font-medium leading-[20px] text-[#1E1E1E]">
          {cr.type === "eot_only" ? (
            <TimeClaimFigures cr={cr} />
          ) : (
            <>
              <span className="font-semibold tabular-nums">{formatWholeCurrency(cr.costImpact, cr.currency)}</span>
              {cr.timeImpactDays > 0 ? (
                <>
                  <Divider />
                  <span>+{cr.timeImpactDays} {cr.timeImpactDays === 1 ? "day" : "days"}</span>
                </>
              ) : null}
            </>
          )}
          {cr.commentCount > 0 ? (
            <span className="text-[12px] font-normal text-[#737373]">
              {cr.commentCount} comment{cr.commentCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </button>

      {canManage ? (
        <>
          <div className="absolute right-[25px] top-[31px] flex items-center gap-[8px]">
            <button type="button" aria-label={`Edit ${cr.title}`} onClick={onEdit} className={ICON_BUTTON}>
              <ReactSVG src={icons2.edit} />
            </button>
            <button type="button" aria-label={`Delete ${cr.title}`} onClick={onDelete} className={ICON_BUTTON}>
              <ReactSVG src={icons2.delete} />
            </button>
          </div>
          {cr.status !== "Executed" ? (
            <div className="mt-[16px]">
              <ChangeRequestActions projectId={projectId} cr={cr} appearance="row" />
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

ChangeRow.displayName = "ChangeRow";
