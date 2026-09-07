import { useState, useMemo } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { TextInput } from "@/components/atoms/text-input";
import { EmptyState } from "@/components";
import { formatRoleLabel } from "./utils";
import { RowMessage } from "./section";
import type { Invitation } from "./types";
import { Search } from "lucide-react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import emptyIcon from "@/assets/images/empty-invitations.png";

// ─── Invitation Row ─────────────────────────────────────────────────────────

interface InvitationRowProps {
  invitation: Invitation;
  canManage: boolean;
  onRequestCancel: (invitation: Invitation) => void;
}

export function InvitationRow({
  invitation,
  canManage,
  onRequestCancel,
}: InvitationRowProps) {
  return (
    <div className="flex items-center gap-4 px-6 py-3.5 border-b border-[#F0F0F0] last:border-b-0">
      <Avatar name={invitation.email} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption-l font-semibold text-black-500">
          {invitation.email}
        </p>
        <p className="truncate text-caption-m text-grey-450">
          Invited as {formatRoleLabel(invitation.role ?? "member")}
        </p>
      </div>

      <Badge tone="warning" variant="soft">
        Pending
      </Badge>

      {canManage && (
        <Button
          variant="danger-outline"
          size="md"
          onClick={() => onRequestCancel(invitation)}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}

// ─── Invitations Section ────────────────────────────────────────────────────

interface InvitationsSectionProps {
  invitations: Invitation[];
  isLoading: boolean;
  canManage: boolean;
  isCancelling: boolean;
  onCancel: (invitationId: string, options?: { onSuccess?: () => void }) => void;
}

export function InvitationsSection({
  invitations,
  isLoading,
  canManage,
  isCancelling,
  onCancel,
}: InvitationsSectionProps) {
  const [search, setSearch] = useState("");
  const [invitationToCancel, setInvitationToCancel] = useState<Invitation | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return invitations;
    const q = search.toLowerCase();
    return invitations.filter((i) => i.email.toLowerCase().includes(q));
  }, [invitations, search]);

  function handleConfirmCancel(): void {
    if (!invitationToCancel) return;
    onCancel(invitationToCancel.id, {
      onSuccess: () => setInvitationToCancel(null),
    });
  }

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={<img src={emptyIcon} alt="" className="w-100 mb-4" />}
        title="Invitations"
        description="You haven't sent any invitations yet. Invite team members to collaborate on your projects."
        className="flex flex-col gap-8 max-w-4xl"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-none border border-[#F0F0F0]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b-[0.5px] border-border px-6 py-3">
        {/* Invitation count */}
        <div className="flex items-center gap-1 bg-grey-50 px-3 py-1.5 h-[36px]">
          <ReactSVG src={icons2.person} className='[&_svg]:size-[16px]' />
          <span className="text-caption-l font-semibold text-black-500">{invitations.length}</span>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-[311px] h-[36px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-5 text-black-500" />
          <TextInput
            type="text"
            placeholder="Search invitations"
            value={search}
            onChange={setSearch}
            className='h-[36px] indent-8'
          />
        </div>
      </div>

      {/* Rows */}
      {isLoading && <RowMessage>Loading invitations…</RowMessage>}
      {!isLoading && filtered.length === 0 && (
        <RowMessage>{search ? "No invitations match your search." : "No invitations yet."}</RowMessage>
      )}
      {!isLoading &&
        filtered.map((invitation) => (
          <InvitationRow
            key={invitation.id}
            invitation={invitation}
            canManage={canManage}
            onRequestCancel={setInvitationToCancel}
          />
        ))}

      <ConfirmDialog
        open={invitationToCancel !== null}
        onOpenChange={(open) => !open && setInvitationToCancel(null)}
        title="Cancel invitation"
        description={
          invitationToCancel
            ? `Cancel the invitation sent to ${invitationToCancel.email}? They will no longer be able to join using this link.`
            : ""
        }
        confirmLabel="Cancel invitation"
        variant="danger"
        loading={isCancelling}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
