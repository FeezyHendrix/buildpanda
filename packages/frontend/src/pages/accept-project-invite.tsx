import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { QueryError } from "@/components/molecules/query-error";
import { useProjectInvitation } from "@/hooks/use-project-invitation";
import { errorMessage, getApiErrorStatus } from "@/lib/api-error";
import { signInPath } from "@/lib/return-path";
import logo from "@/assets/images/logo.svg";

export default function AcceptProjectInvite() {
  const { token = "" } = useParams();
  const invitation = useProjectInvitation(token);
  return <div className="flex min-h-screen items-center justify-center bg-surface-alt p-6">
    <Card padding="none" className="w-full max-w-xl p-8 text-center sm:p-12">
      <img src={logo} alt="BuildPanda" className="mx-auto h-8 w-auto" />
      <div className="mt-8"><InvitationContent invitation={invitation} /></div>
    </Card>
  </div>;
}

function InvitationContent({ invitation }: { invitation: ReturnType<typeof useProjectInvitation> }) {
  const { preview, session, user, emailMatches, join, accept, switchAccount, destination } = invitation;
  const invite = preview.data;
  if (preview.isPending || session.isPending) return <div className="flex justify-center"><Spinner size="md" /></div>;
  if (preview.error) {
    if (getApiErrorStatus(preview.error) === 404) return <p className="text-sm text-ink-muted">This invitation is invalid or has been withdrawn. Ask the person who invited you for a new link.</p>;
    return <QueryError error={preview.error} retry={preview.refetch} noun="this invitation" />;
  }
  if (session.error) return <QueryError error={session.error} retry={session.refetch} noun="your account" />;
  if (!invite) return null;
  if (invite.expired) return <p className="text-sm text-ink-muted">This invitation has expired. Ask the person who invited you to send a new one.</p>;

  return <div className="flex flex-col gap-6">
    <div>
      <h1 className="text-2xl font-medium text-ink">Follow {invite.projectName}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {invite.inviterName ? `${invite.inviterName} invited you` : "You've been invited"} to follow this build as the {invite.role}.
      </p>
    </div>
    {user && emailMatches ? <>
      <Button size="lg" loading={accept.isPending || session.isFetching} onClick={join}>
        {accept.isError ? "Try again" : "Open my portal"}
      </Button>
      {accept.error ? <p role="alert" className="text-sm text-negative-600">{errorMessage(accept.error, "Could not accept the invitation. Please try again.")}</p> : null}
    </> : null}
    {user && !emailMatches ? <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">This invitation was sent to <strong className="text-ink">{invite.email}</strong>. You're signed in as <strong className="text-ink">{user.email}</strong>.</p>
      <Button size="lg" loading={switchAccount.isPending} onClick={() => switchAccount.mutate()}>Use invited account</Button>
      {switchAccount.error ? <p role="alert" className="text-sm text-negative-600">{errorMessage(switchAccount.error, "Could not switch accounts. Please try again.")}</p> : null}
    </div> : null}
    {!user ? <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">Sign in or create an account as <strong className="text-ink">{invite.email}</strong> to continue.</p>
      <Link to={`/auth/sign-up?email=${encodeURIComponent(invite.email)}&redirect=${encodeURIComponent(destination)}`}>
        <Button size="lg" className="w-full">Create account</Button>
      </Link>
      <Link to={signInPath(destination)} className="text-sm font-medium text-primary-500 hover:text-primary-600">I already have an account</Link>
    </div> : null}
  </div>;
}
