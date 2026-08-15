import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Select } from "@/components/atoms/select";
import { TextInput } from "@/components/atoms/text-input";
import { cn } from "@/lib/utils";

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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole(null);
    }
  }, [open]);

  const isValid = EMAIL_PATTERN.test(email.trim()) && role !== null;

  function handleSubmit(): void {
    if (!isValid || isSubmitting) return;
    onSubmit({ email: email.trim().toLowerCase(), role: role as string });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-[#000000]/50 backdrop-blur-[0.5px] transition-opacity duration-150 ease-out",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(540px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "bg-white p-8 shadow-xl outline-none",
            "transition-[transform,opacity] duration-200 ease-out",
            "data-[starting-style]:translate-y-[calc(-50%+12px)] data-[starting-style]:opacity-0",
            "data-[ending-style]:translate-y-[calc(-50%+12px)] data-[ending-style]:opacity-0",
          )}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="flex flex-col gap-6"
          >
            <header>
              <Dialog.Title className="text-h4 font-bold text-black-500">
                Invite Team Member
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-caption-l font-medium text-grey-450 text-pretty">
                Invite a team member to join your workspace. Assign a role to
                control what they can access and manage.
              </Dialog.Description>
            </header>

            <div className="flex flex-col gap-4">
              <TextInput
                label="Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                autoFocus
                maxLength={254}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#1E1E1E]">
                  Role
                </label>
                <Select
                  value={role}
                  options={roleOptions}
                  onChange={setRole}
                  placeholder="Select Role"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <div className="flex flex-col items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!isValid || isSubmitting}
                loading={isSubmitting}
                className="w-full"
              >
                Send Invitation
              </Button>
              <Dialog.Close
                render={
                  <Button
                    size='lg'
                    type="button"
                    variant='ghost'
                    className="w-full"
                  >
                    Cancel
                  </Button>
                }
              />
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

InviteMemberDialog.displayName = "InviteMemberDialog";

export { InviteMemberDialog, type InviteMemberDialogProps };
