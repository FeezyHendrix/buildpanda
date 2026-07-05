import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { usePendingUserInvitations } from "@/hooks/use-organization";

/**
 * Surfaces workspace invitations addressed to the signed-in user on the
 * dashboard, so an invite is discoverable even if the email never arrived.
 */
export function PendingInvitesBanner() {
  const { data: invitations = [] } = usePendingUserInvitations();
  if (invitations.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-3"
        >
          <p className="text-sm text-gray-700">
            You&apos;ve been invited to join{" "}
            <strong>
              {(invitation as { organizationName?: string }).organizationName ??
                "a workspace"}
            </strong>{" "}
            as <strong>{invitation.role}</strong>.
          </p>
          <Link to={`/accept-invitation/${invitation.id}`}>
            <Button size="sm">View invitation</Button>
          </Link>
        </div>
      ))}
    </div>
  );
}

PendingInvitesBanner.displayName = "PendingInvitesBanner";
