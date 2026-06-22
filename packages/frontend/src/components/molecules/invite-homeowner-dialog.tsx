import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import type { KnownParticipantRole, ParticipantRole } from "@/lib/project-types";

export interface InviteHomeownerValues {
  email: string;
  name: string;
  role: ParticipantRole;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: InviteHomeownerValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const ROLES: { value: KnownParticipantRole; label: string }[] = [
  { value: "client", label: "Homeowner (client)" },
  { value: "architect", label: "Architect" },
  { value: "inspector", label: "Inspector" },
  { value: "guest", label: "Guest (view only)" },
];

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function InviteHomeownerDialog({ open, onOpenChange, onSubmit, isSubmitting = false, error }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ParticipantRole>("client");
  const [customRoleOpen, setCustomRoleOpen] = useState(false);
  const [customRole, setCustomRole] = useState("");

  useEffect(() => {
    if (open) {
      setEmail("");
      setName("");
      setRole("client");
      setCustomRoleOpen(false);
      setCustomRole("");
    }
  }, [open]);

  const selectedRole = customRoleOpen ? customRole.trim() : role;

  function handleSubmit(): void {
    if (!email.trim() || !selectedRole) return;
    onSubmit({ email: email.trim(), name: name.trim(), role: selectedRole });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Invite to this project"
      description="Give the homeowner (or another stakeholder) their own portal to follow this build."
      submitLabel="Send invite"
      submitDisabled={!email.trim() || !selectedRole}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-email">Email</Label>
        <input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@email.com" className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-name">Name (optional)</Label>
        <input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="inv-role">Role</Label>
          <button
            type="button"
            onClick={() => setCustomRoleOpen((current) => !current)}
            className="inline-flex size-6 items-center justify-center rounded-full bg-[#004DE7] text-sm font-semibold leading-none text-white hover:bg-[#0041c4]"
            aria-label={customRoleOpen ? "Use preset roles" : "Add custom role"}
            title={customRoleOpen ? "Use preset roles" : "Add custom role"}
          >
            {customRoleOpen ? "×" : "+"}
          </button>
        </div>
        {customRoleOpen ? (
          <input
            id="inv-role"
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
            placeholder="e.g. Quantity Surveyor"
            className={field}
          />
        ) : (
          <select
            id="inv-role"
            value={role}
            onChange={(e) => setRole(e.target.value as KnownParticipantRole)}
            className={field}
          >
            {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
        )}
      </div>
    </FormDrawer>
  );
}

InviteHomeownerDialog.displayName = "InviteHomeownerDialog";

export { InviteHomeownerDialog };
