import { useState } from "react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { cn } from "@/lib/utils";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useInviteParticipant, useUpdateParticipant } from "@/hooks/use-participants";
import type {
  KnownParticipantRole,
  ParticipantPermissions,
  ProjectParticipant,
  SectionPermission,
} from "@/lib/project-types";
import { KNOWN_ROLES, ROLE_META, PERMISSION_MATRIX, ROLE_DEFAULTS } from "./invite-participant-drawer/constants";
import { SegmentedPermission } from "./invite-participant-drawer/segmented-permission";
import { RolePill } from "./invite-participant-drawer/role-pill";



export interface InviteParticipantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initial?: ProjectParticipant;
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
  const [showCustomRole, setShowCustomRole] = useState(
    Boolean(
      initial?.role &&
        initial.role !== "owner" &&
        !KNOWN_ROLES.includes(initial.role as KnownParticipantRole),
    ),
  );
  const [customRole, setCustomRole] = useState(
    initial?.role && !KNOWN_ROLES.includes(initial.role as KnownParticipantRole) && initial.role !== "owner"
      ? initial.role
      : "",
  );
  const [permissions, setPermissions] = useState<ParticipantPermissions>(() => {
    if (initial?.permissions && Object.keys(initial.permissions).length > 0) {
      return initial.permissions;
    }
    const r = initial?.role as KnownParticipantRole | undefined;
    return r && ROLE_DEFAULTS[r] ? { ...ROLE_DEFAULTS[r] } : {};
  });
  const [showMatrix, setShowMatrix] = useState(isEdit);

  const { data: flagsData } = useFeatureFlags();
  const invite = useInviteParticipant();
  const update = useUpdateParticipant();
  const mutation = isEdit ? update : invite;

  const enabledFlagKeys = new Set(
    (flagsData?.flags ?? []).filter((f) => f.enabled !== false).map((f) => f.key),
  );
  const visibleGroups = PERMISSION_MATRIX.map((g) => ({
    ...g,
    items: g.items.filter((i) => enabledFlagKeys.size === 0 || enabledFlagKeys.has(i.key)),
  })).filter((g) => g.items.length > 0);

  function handleRoleSelect(r: KnownParticipantRole) {
    setRole(r);
    setShowCustomRole(false);
    setCustomRole("");
    setPermissions({ ...ROLE_DEFAULTS[r] });
  }

  function handleCustomRoleChange(value: string) {
    setCustomRole(value);
    setRole(value.trim());
    if (value.trim()) setPermissions({});
  }

  function handlePermission(key: string, value: SectionPermission) {
    setPermissions((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const effectiveRole = role.trim() || undefined;
    if (isEdit && initial) {
      update.mutate(
        { projectId, participantId: initial.id, role: effectiveRole, permissions },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      invite.mutate(
        { projectId, email, name: name.trim() || undefined, role: effectiveRole, permissions },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  }

  const showRoleSection = isEdit || email.trim().length > 0;
  const showPermissionToggle = Boolean(role.trim());

  const inputCls =
    "w-full rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10";
  const labelCls = "mb-1.5 block text-xs font-medium text-gray-600";

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
      {showRoleSection && (
        <div className="flex flex-col gap-2.5 border-t border-[#F0F0F0] pt-5">
          <p className="text-sm font-semibold text-gray-900">Role</p>
          {KNOWN_ROLES.map((r) => (
            <RolePill
              key={r}
              meta={ROLE_META[r]}
              selected={role === r}
              onSelect={() => handleRoleSelect(r)}
            />
          ))}

          {showCustomRole ? (
            <input
              autoFocus
              type="text"
              placeholder="e.g. Quantity Surveyor"
              value={customRole}
              onChange={(e) => handleCustomRoleChange(e.target.value)}
              className={cn(
                inputCls,
                customRole.trim() && "border-brand/40 bg-white ring-2 ring-brand/10",
              )}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomRole(true)}
              className="py-1 text-left text-xs font-medium text-gray-400 transition-colors hover:text-brand"
            >
              + Add custom role
            </button>
          )}
        </div>
      )}

      {/* Phase 3 — permission matrix */}
      {showPermissionToggle && (
        <div className="flex flex-col border-t border-[#F0F0F0] pt-5">
          <button
            type="button"
            onClick={() => setShowMatrix((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">Access permissions</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {showMatrix
                  ? "Customise what each section shows for this person."
                  : "Role defaults applied. Tap to customise."}
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                "h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200",
                showMatrix && "rotate-180",
              )}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showMatrix && (
            <div className="mt-4 flex flex-col gap-5">
              {visibleGroups.map((group) => (
                <div key={group.group}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {group.group}
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {group.items.map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700">{item.label}</span>
                        <div className="w-40 shrink-0">
                          <SegmentedPermission
                            value={permissions[item.key] ?? "hidden"}
                            onChange={(v) => handlePermission(item.key, v)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </FormDrawer>
  );
}

InviteParticipantDrawer.displayName = "InviteParticipantDrawer";
