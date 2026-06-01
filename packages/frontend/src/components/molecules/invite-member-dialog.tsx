import { useEffect, useState } from "react";
import { FormDialog } from "./form-dialog";
import { Label } from "@/components/atoms/label";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleOptions: { value: string; label: string }[];
  onSubmit: (input: { email: string; role: string }) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InviteMemberDialog({
  open,
  onOpenChange,
  roleOptions,
  onSubmit,
  isSubmitting = false,
  error,
}: InviteMemberDialogProps) {
  const defaultRole = roleOptions[0]?.value ?? "member";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(defaultRole);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole(defaultRole);
    }
  }, [open, defaultRole]);

  const isValid = EMAIL_PATTERN.test(email.trim()) && role.length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({ email: email.trim().toLowerCase(), role });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite a team member"
      description="Send an email invitation to join this company. They will choose a password when they accept."
      submitLabel="Send invitation"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-email">Email address</Label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          maxLength={254}
          placeholder="teammate@company.com"
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        >
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </FormDialog>
  );
}

InviteMemberDialog.displayName = "InviteMemberDialog";

export { InviteMemberDialog, type InviteMemberDialogProps };
