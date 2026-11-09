import { useNavigate, useParams, Link } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { FormField } from "@/components/molecules";
import { authClient } from "@/lib/auth-client";
import { PENDING_ORG_INVITE_KEY } from "@/lib/route-guards";
import {
  useAcceptInvitation,
  useRejectInvitation,
} from "@/hooks/use-organization";
import { useDeclinePublicInvitation, usePublicInvitation } from "@/hooks/use-invitations";
import { toast } from "@/lib/toast";
import logo from "@/assets/images/logo.svg";
import illustration from "@/assets/images/createProjectIllustration.png";
import { icons2 } from "@/assets/icons2/icon2";
import { ReactSVG } from "react-svg";

export default function AcceptInvitation() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  // The invited person has no account yet, so the invitation is always read
  // through the public (no-session) endpoint — see api/invitations.ts.
  const invitationQuery = usePublicInvitation(invitationId, {
    enabled: !sessionPending,
  });

  const acceptInvitation = useAcceptInvitation();
  const rejectInvitation = useRejectInvitation();

  useEffect(() => {
    if (sessionPending || !invitationId) return;
    if (signedIn) {
      localStorage.removeItem(PENDING_ORG_INVITE_KEY);
    } else {
      localStorage.setItem(PENDING_ORG_INVITE_KEY, invitationId);
    }
  }, [sessionPending, signedIn, invitationId]);

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
        <Link to="/" className="mt-6 inline-block">
          <Button variant="secondary" size="lg">
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
      <InvitationShell
        organizationName={invitation.organizationName}
        title="Invitation already handled"
      >
        <p className="text-sm text-gray-500">
          This invitation has already been {invitation.status}.
        </p>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="secondary" size="lg">
            Go to dashboard
          </Button>
        </Link>
      </InvitationShell>
    );
  }

  if (!signedIn) {
    return (
      <JoinTeamForm
        invitationId={invitationId!}
        organizationName={invitation.organizationName}
        email={invitation.email}
      />
    );
  }

  const emailMismatch =
    session!.user.email.toLowerCase() !== invitation.email.toLowerCase();

  async function switchAccount(): Promise<void> {
    if (invitationId) localStorage.setItem(PENDING_ORG_INVITE_KEY, invitationId);
    await authClient.signOut();
    navigate(`/auth/sign-in?redirect=${encodeURIComponent(`/accept-invitation/${invitationId}`)}`);
  }

  if (emailMismatch) {
    return (
      <InvitationShell organizationName={invitation.organizationName} title="Wrong account">
        <p className="text-sm text-gray-500">
          This invitation was sent to <strong>{invitation.email}</strong>, but
          you are signed in as <strong>{session!.user.email}</strong>. Sign in
          with the invited email to accept.
        </p>
        <div className="mt-6">
          <Button size="lg" className="w-full" onClick={() => void switchAccount()}>
            Sign out & use a different account
          </Button>
        </div>
      </InvitationShell>
    );
  }

  function handleAccept(): void {
    if (!invitationId) return;
    acceptInvitation.mutate(invitationId, {
      onSuccess: () => {
        localStorage.removeItem(PENDING_ORG_INVITE_KEY);
        // Straight into the workspace they just joined (it is now active).
        navigate("/dashboard");
      },
    });
  }

  function handleReject(): void {
    if (!invitationId) return;
    rejectInvitation.mutate(invitationId, {
      onSuccess: () => {
        localStorage.removeItem(PENDING_ORG_INVITE_KEY);
        navigate("/");
      },
    });
  }

  const actionError = acceptInvitation.error ?? rejectInvitation.error;
  const isActing = acceptInvitation.isPending || rejectInvitation.isPending;

  return (
    <InvitationShell
      organizationName={invitation.organizationName}
      title={`Join ${invitation.organizationName}`}
    >
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
          size="lg"
          onClick={handleAccept}
          disabled={isActing}
          className="flex-1"
        >
          Accept invitation
        </Button>
        <Button
          variant="secondary"
          size="lg"
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

// ── "Join the team" form — invited, no account yet ─────────────────────────

interface JoinTeamFormProps {
  invitationId: string;
  organizationName: string;
  email: string;
}

function JoinTeamForm({ invitationId, organizationName, email }: JoinTeamFormProps) {
  const navigate = useNavigate();
  const declineInvitation = useDeclinePublicInvitation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signUpError } = await authClient.signUp.email({
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message ?? "Failed to create account.");
      return;
    }

    // Invitation acceptance happens server-side once the email is verified
    // (afterEmailVerification in lib/auth.ts), not from this screen.
    toast("Check your email to verify your account, then log in to join the team.", "success");
    navigate("/auth/sign-in");
  }

  function handleDecline(): void {
    declineInvitation.mutate(invitationId, {
      onSuccess: () => {
        localStorage.removeItem(PENDING_ORG_INVITE_KEY);
        navigate("/");
      },
      onError: () => {
        toast("Could not decline the invitation. Please try again.", "error");
      },
    });
  }

  return (
    <InvitationShell organizationName={organizationName} title="Join the team">
      <p className="text-caption-l text-grey-450">
        Enter your details in order to access the company workspace
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="First Name"
            name="firstName"
            placeholder="Michael"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <FormField
            label="Last Name"
            name="lastName"
            placeholder="Scott"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <FormField
          label="Password"
          name="password"
          type="password"
          placeholder="Create a strong password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="mt-12 flex flex-col gap-4">
          <Button 
            type="submit" 
            size='lg' 
            className="w-full h-[46px]" 
            loading={loading}
            disabled={loading || !firstName.trim() || !lastName.trim() || !password}
          >
            Confirm
          </Button>

          <Button
            size='lg'
            variant='ghost'
            type="button"
            onClick={handleDecline}
            disabled={declineInvitation.isPending}
            className="text-caption-l font-bold text-black-500 hover:text-gray-600 disabled:opacity-50"
          >
            Reject Invitation
          </Button>
        </div>
      </form>
    </InvitationShell>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

interface InvitationShellProps {
  title?: string;
  organizationName?: string;
  children: ReactNode;
}

function InvitationShell({ title, organizationName, children }: InvitationShellProps) {
  return (
    <div 
      className="flex min-h-dvh flex-col items-center justify-between gap-8  bg-cover bg-center bg-no-repeat px-4 py-10"  
      style={{ backgroundImage: `url(${illustration})` }}
    >
      <Link to="/">
        <img src={logo} alt="BuildPanda" className="h-9" />
      </Link>

      <div className={`w-full max-w-[462px] ${!organizationName ? 'min-h-[514px]' : 'min-h-[200px]'} overflow-hidden border border-black-500 bg-white`}>
        {organizationName && (
          <div className="flex items-center gap-2 bg-secondary px-8 py-3">
            <ReactSVG src={icons2.city} />
            <span className="text-caption-l font-bold text-black-500">
              {organizationName}
            </span>
          </div>
        )}

        <div className="p-8 pb-14">
          {title && (
            <h4 className="text-h4 font-bold text-grey-800 text-balance">
              {title}
            </h4>
          )}
          <div className={title ? "mt-2" : ""}>{children}</div>
        </div>
      </div>

      <div className="mt-4 w-full"/>
    </div>
  );
}
