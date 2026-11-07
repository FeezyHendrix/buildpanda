import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import { useRemoveParticipant } from "@/hooks/use-participants";
import type { ProjectParticipant } from "@/lib/project-types";
import { SIDE_LABEL, displayName, roleLabel } from "./shared";

/** One person with access: who they are, their role (a menu into editing it) and a remove button. */
export function ParticipantRow({
  projectId,
  participant,
  onEdit,
}: {
  projectId: string;
  participant: ProjectParticipant;
  onEdit: () => void;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const remove = useRemoveParticipant();
  const isOwner = participant.role === "owner";
  const name = displayName(participant);
  const label = name ?? participant.email;

  return (
    <div className="flex h-[72px] items-center gap-[16px] border-b border-[#F7F7F7] pl-[24px] pr-[33px]">
      <Avatar name={label} className="size-[40px] bg-[#E6EDFD] text-[14px] text-[#004DE7]" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium leading-[20px] text-[#1E1E1E]">{label}</p>
        {name ? <p className="truncate text-[14px] leading-[20px] text-[#737373]">{participant.email}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-[14px]">
        {participant.side ? (
          <Badge tone={participant.side === "client" ? "accent" : "neutral"} size="sm" className="hidden sm:inline-flex">
            {SIDE_LABEL[participant.side]}
          </Badge>
        ) : null}
        {participant.status === "invited" ? (
          <Badge tone="neutral" size="sm">
            Invited
          </Badge>
        ) : null}

        {isOwner ? (
          <Badge tone="info" size="sm">
            Owner
          </Badge>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Role: ${roleLabel(participant.role)}. Open menu`}
                    className="flex h-[36px] items-center gap-[6px] border border-[#EEEEEE] bg-white px-[8px] text-[14px] text-[#1E1E1E] outline-none transition-colors hover:bg-[#F9F9F9] focus-visible:ring-2 focus-visible:ring-gray-900/10"
                  >
                    {roleLabel(participant.role)}
                    <ChevronDown className="size-[14px]" strokeWidth={1.5} />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem onSelect={onEdit}>Edit role &amp; access</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => setRemoveOpen(true)}
              aria-label={`Remove ${label}'s access`}
              className="flex size-[20px] items-center justify-center rounded-full bg-[#A1A1A1] text-white outline-none transition-colors hover:bg-[#737373] focus-visible:ring-2 focus-visible:ring-gray-900/20"
            >
              <X className="size-[12px]" strokeWidth={3} />
            </button>
          </>
        )}
      </div>

      {isOwner ? null : (
        <ConfirmDialog
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          onConfirm={() =>
            remove.mutate(
              { projectId, participantId: participant.id },
              { onSuccess: () => setRemoveOpen(false) },
            )
          }
          loading={remove.isPending}
          title="Remove access"
          description={`Remove ${participant.name ?? participant.email}'s access to this project?`}
          confirmLabel="Remove"
          variant="danger"
        />
      )}
    </div>
  );
}

ParticipantRow.displayName = "ParticipantRow";
