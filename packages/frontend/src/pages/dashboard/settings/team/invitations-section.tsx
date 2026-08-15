import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { formatRoleLabel } from "./utils";
import { Section } from "./section";
import type { Invitation } from "./types";
import { EmptyState } from "@/components";
import emptyIcon from "@/assets/images/empty-invitations.png";

interface InvitationsSectionProps {
  invitations: Invitation[];
  isCancelling: boolean;
  onCancel: (invitationId: string) => void;
}

export function InvitationsSection({
  invitations,
  isCancelling,
  onCancel,
}: InvitationsSectionProps) {
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
    <Section>
      {invitations.map((invitation) => (
        <div key={invitation.id} className="flex items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {invitation.email}
            </p>
            <p className="text-xs text-gray-500">
              Invited as {formatRoleLabel(invitation.role ?? "member")}
            </p>
          </div>
          <Badge tone="warning" variant="soft">
            Pending
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(invitation.id)}
            disabled={isCancelling}
            className="text-red-600 hover:bg-red-50"
          >
            Cancel
          </Button>
        </div>
      ))}
    </Section>
  );
}
