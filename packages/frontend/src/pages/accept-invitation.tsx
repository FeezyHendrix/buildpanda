import { useNavigate, useParams, Link } from "react-router-dom";
import { type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { authClient } from "@/lib/auth-client";
import {
  useAcceptInvitation,
  useInvitation,
  useRejectInvitation,
} from "@/hooks/use-organization";

export default function AcceptInvitation() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const invitationQuery = useInvitation(invitationId);
  const acceptInvitation = useAcceptInvitation();
  const rejectInvitation = useRejectInvitation();

  if (sessionPending || invitationQuery.isPending) {
    return <InvitationShell>Loading invitation…</InvitationShell>;
  }

  if (invitationQuery.isError || !invitationQuery.data) {
    return (
      <InvitationShell title="Invitation not found">
        <p className="text-sm text-gray-500">
          This invitation is no longer valid. It may have been cancelled or
          already used.
        </p>
        <Link to="/dashboard" className="mt-6 inline-block">
          <Button variant="secondary" size="sm">
            Go to dashboard
          </Button>
        </Link>
      </InvitationShell>
    );
  }

  const invitation = invitationQuery.data;
  const isResolved = invitation.status !== "pending";

  if (isResolved) {
    return (
      <InvitationShell title="Invitation already handled">
        <p className="text-sm text-gray-500">
          This invitation has already been {invitation.status}.
        </p>
        <Link to="/dashboard" className="mt-6 inline-block">
          <Button variant="secondary" size="sm">
            Go to dashboard
          </Button>
        </Link>
      </InvitationShell>
    );
  }

  if (!session) {
    const redirectTo = encodeURIComponent(
      `/accept-invitation/${invitationId}`,
    );
    return (
      <InvitationShell title={`Join ${invitation.organizationName}`}>
        <p className="text-sm text-gray-500">
          You were invited as <strong>{invitation.email}</strong>. Sign in or
          create your account to accept.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link to={`/auth/sign-in?redirect=${redirectTo}`}>
            <Button size="sm" className="w-full">
              Sign in to accept
            </Button>
          </Link>
          <Link to={`/auth/sign-up?redirect=${redirectTo}`}>
            <Button variant="secondary" size="sm" className="w-full">
              Create an account
            </Button>
          </Link>
        </div>
      </InvitationShell>
    );
  }

  const emailMismatch =
    session.user.email.toLowerCase() !== invitation.email.toLowerCase();

  if (emailMismatch) {
    return (
      <InvitationShell title="Wrong account">
        <p className="text-sm text-gray-500">
          This invitation was sent to <strong>{invitation.email}</strong>, but
          you are signed in as <strong>{session.user.email}</strong>. Sign in
          with the invited email to accept.
        </p>
      </InvitationShell>
    );
  }

  function handleAccept(): void {
    if (!invitationId) return;
    acceptInvitation.mutate(invitationId, {
      onSuccess: () => navigate("/dashboard"),
    });
  }

  function handleReject(): void {
    if (!invitationId) return;
    rejectInvitation.mutate(invitationId, {
      onSuccess: () => navigate("/dashboard"),
    });
  }

  const actionError = acceptInvitation.error ?? rejectInvitation.error;
  const isActing = acceptInvitation.isPending || rejectInvitation.isPending;

  return (
    <InvitationShell title={`Join ${invitation.organizationName}`}>
      <p className="text-sm text-gray-500">
        You have been invited to join{" "}
        <strong>{invitation.organizationName}</strong> as{" "}
        <strong>{invitation.role}</strong>.
      </p>

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {actionError.message}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={isActing}
          className="flex-1"
        >
          Accept invitation
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReject}
          disabled={isActing}
          className="flex-1"
        >
          Decline
        </Button>
      </div>
    </InvitationShell>
  );
}

interface InvitationShellProps {
  title?: string;
  children: ReactNode;
}

function InvitationShell({ title, children }: InvitationShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#FAFAFA] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        {title && (
          <h1 className="text-xl font-bold text-gray-900 text-balance">
            {title}
          </h1>
        )}
        <div className={title ? "mt-3" : ""}>{children}</div>
      </div>
    </div>
  );
}
