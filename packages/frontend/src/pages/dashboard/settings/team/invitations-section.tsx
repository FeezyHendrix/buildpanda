import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { formatRoleLabel } from "./utils";
import { Section, RowMessage } from "./section";
import type { Invitation } from "./types";

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
  return (
    <Section title="Pending invitations">
      {invitations.length === 0 && (
        <RowMessage>No pending invitations.</RowMessage>
      )}
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
