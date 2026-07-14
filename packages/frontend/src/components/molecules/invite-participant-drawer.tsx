import { useState } from "react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { cn } from "@/lib/utils";
import {
  useInviteParticipant,
  useUpdateParticipant,
  usePermissionCatalog,
  useProjectAccess,
} from "@/hooks/use-participants";
import type { ProjectParticipant } from "@/lib/project-types";

export interface InviteParticipantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initial?: ProjectParticipant;
}

function humanizeResource(r: string) {
  const map: Record<string, string> = {
    "action-items": "Action items",
    "change-requests": "Change requests",
    "contract-instructions": "Contract instructions",
    "daily-reports": "Daily reports",
    "drawings": "Drawings",
    "instructions": "Instructions",
    "payment-claims": "Payment claims",
    "photos": "Photos",
    "proposals": "Proposals",
    "rfi": "RFIs",
    "site-observations": "Site observations",
    "specifications": "Specifications",
    "variations": "Variations",
  };
  if (map[r]) return map[r];
  return r.charAt(0).toUpperCase() + r.slice(1).replace(/-/g, " ");
}

function humanizeAction(a: string) {
  return a.charAt(0).toUpperCase() + a.slice(1).replace(/-/g, " ");
}

export function InviteParticipantDrawer({
  open,
  onOpenChange,
  projectId,
  initial,
}: InviteParticipantDrawerProps) {
  const isEdit = Boolean(initial);

  const [email, setEmail] = useState(initial?.email ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(
    initial?.role && initial.role !== "owner" ? initial.role : "",
  );
  
  const [grants, setGrants] = useState<Record<string, string[]>>(() => {
    if (initial?.grants && Object.keys(initial.grants).length > 0) {
      return initial.grants;
    }
    return isEdit ? {} : { project: ["view"] };
  });

  const { data: catalog } = usePermissionCatalog();
  const { data: access } = useProjectAccess(projectId);
  const isOrgAdmin = access?.orgRole === "owner" || access?.orgRole === "admin";

  const invite = useInviteParticipant();
  const update = useUpdateParticipant();
  const mutation = isEdit ? update : invite;

  function handleToggleGrant(resource: string, action: string, checked: boolean) {
    setGrants((prev) => {
      const current = prev[resource] ?? [];
      let next: string[];
      if (checked) {
        if (current.includes(action)) return prev;
        next = [...current, action];
      } else {
        if (!current.includes(action)) return prev;
        next = current.filter((a) => a !== action);
      }
      
      const updated = { ...prev };
      if (next.length === 0) {
        delete updated[resource];
      } else {
        updated[resource] = next;
      }
      return updated;
    });
  }

  function handleSubmit() {
    const effectiveRole = role.trim() || undefined;
    if (isEdit && initial) {
      update.mutate(
        { projectId, participantId: initial.id, role: effectiveRole, grants },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      invite.mutate(
        { projectId, email, name: name.trim() || undefined, role: effectiveRole, grants },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10";
  const labelCls = "mb-1.5 block text-xs font-medium text-gray-600";

  const resources = catalog?.resources ?? {};
  const privileged = catalog?.privileged ?? {};

  const resourceKeys = Object.keys(resources).sort((a, b) => {
    if (a === "project") return -1;
    if (b === "project") return 1;
    return a.localeCompare(b);
  });

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit access" : "Invite someone"}
      description={
        isEdit
          ? "Update this person's role and access permissions."
          : "Invite a client or team member and control what they can see."
      }
      submitLabel={isEdit ? "Save changes" : "Send invite"}
      submitting={mutation.isPending}
      submitDisabled={!isEdit && email.trim().length < 3}
      error={(mutation.error as Error | undefined)?.message ?? null}
      onSubmit={handleSubmit}
    >
      {/* Phase 1 — contact info */}
      <div className="flex flex-col gap-3">
        <div>
          <label className={labelCls}>Email</label>
          {isEdit ? (
            <div className="w-full rounded-xl border border-[#E8E8E8] bg-[#F4F4F4] px-3.5 py-2.5 text-sm text-gray-400">
              {email}
            </div>
          ) : (
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          )}
        </div>
        {!isEdit && (
          <div>
            <label className={labelCls}>
              Name{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Sam Okonkwo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
        )}
      </div>

      {/* Phase 2 — role selection */}
      <div className="mt-5 flex flex-col gap-1.5 border-t border-[#F0F0F0] pt-5">
        <label className={labelCls}>Role</label>
        <input
          type="text"
          placeholder="e.g. Project Manager, Client, Engineer"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={cn(
            inputCls,
            role.trim() && "border-brand/40 bg-white ring-2 ring-brand/10",
          )}
        />
      </div>

      {/* Phase 3 — permissions */}
      <div className="mt-5 flex flex-col border-t border-[#F0F0F0] pt-5">
        <div>
          <p className="text-sm font-semibold text-gray-900">Permissions</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Grant specific actions for each area of the project.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-5">
          {resourceKeys.map((resource) => (
            <div key={resource}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {humanizeResource(resource)}
              </p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                {(resources[resource] ?? []).map((action) => {
                  const isPrivileged = privileged[resource]?.includes(action);
                  const disabled = isPrivileged && !isOrgAdmin;
                  const checked = grants[resource]?.includes(action) ?? false;
                  
                  return (
                    <label
                      key={action}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer text-sm transition-colors",
                        disabled ? "opacity-50 cursor-not-allowed" : "hover:text-brand"
                      )}
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={checked}
                        onChange={(e) => handleToggleGrant(resource, action, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand disabled:cursor-not-allowed"
                      />
                      <span className="flex items-center gap-1.5 text-gray-700">
                        {humanizeAction(action)}
                        {disabled && (
                          <span className="text-[10px] text-gray-400 font-medium tracking-wide">(Admin only)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </FormDrawer>
  );
}

InviteParticipantDrawer.displayName = "InviteParticipantDrawer";