import { useState } from "react";
import { Plus } from "lucide-react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { PermissionGroupCard } from "@/components/molecules/permission-group-card";
import { TextInput } from "@/components/atoms/text-input";
import { errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { INPUT_CLASS } from "@/components/atoms/input";
import {
  useInviteParticipant,
  useUpdateParticipant,
  usePermissionCatalog,
  useProjectAccess,
} from "@/hooks/use-participants";
import type { ProjectParticipant } from "@/lib/project-types";
import { Button } from "../atoms";

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
    "dailyLog": "Daily log",
    "drawings": "Drawings",
    "instructions": "Instructions",
    "key-dates": "Key dates",
    "payment-claims": "Payment requests",
    "photos": "Photos",
    "proposals": "Proposals",
    "rfi": "RFIs",
    "rfis": "RFIs",
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

function getPresetLabel(key: string) {
  const map: Record<string, string> = {
    client: "Client",
    project_manager: "Project Manager",
    architect: "Architect",
    inspector: "Inspector",
    guest: "Guest",
    materials_requester: "Materials Requester",
    materials_approver: "Materials Approver",
  };
  if (map[key]) return map[key];
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const GROUPS = [
  { name: "Project", keys: ["project", "tasks", "schedule", "documents", "bim", "stages"] },
  { name: "Quality & Risks", keys: ["inspections", "dailyLog", "risks"] },
  { name: "Commercial", keys: ["finances", "materials"] },
  { name: "Workflow", keys: ["rfis", "approvals", "selections", "change-requests"] },
  { name: "Compliance", keys: ["permits", "key-dates"] },
  { name: "Collaboration", keys: ["updates", "messages", "comments", "contractors", "participants"] },
];

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
  
  // Roles typed in "Custom Category" and added with +, shown as pills beside the presets.
  const [customRoles, setCustomRoles] = useState<string[]>(() =>
    initial?.role && initial.role !== "owner" ? [initial.role] : [],
  );
  const [customDraft, setCustomDraft] = useState("");

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

  const resources = catalog?.resources ?? {};
  const privileged = catalog?.privileged ?? {};
  const presets = catalog?.presets ?? {};

  function addCustomRole() {
    const value = customDraft.trim();
    if (!value) return;
    setCustomRoles((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setRole(value);
    setCustomDraft("");
  }

  function handlePresetClick(presetKey: string) {
    const presetName = getPresetLabel(presetKey);
    setRole(presetName);
    setCustomDraft("");
    
    if (!presets || !presets[presetKey]) return;

    const newGrants: Record<string, string[]> = {};
    for (const [resource, actions] of Object.entries(presets[presetKey])) {
      const validActions = (actions as string[]).filter(a => {
        const isPriv = privileged[resource]?.includes(a);
        return !isPriv || isOrgAdmin;
      });
      if (validActions.length > 0) {
        newGrants[resource] = [...validActions];
      }
    }
    setGrants(newGrants);
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

const LABEL_CLASS = "text-caption-m! font-semibold text-[#1E1E1E]";

  const resourceKeys = Object.keys(resources);

  const resourceGroups: { name: string; resources: string[] }[] = GROUPS.map(g => ({ name: g.name, resources: [] }));
  const moreGroup = { name: "More", resources: [] as string[] };

  const knownKeys = new Set(GROUPS.flatMap(g => g.keys));

  for (const r of resourceKeys) {
    if (knownKeys.has(r)) {
      const group = resourceGroups.find(g => GROUPS.find(gr => gr.name === g.name)?.keys.includes(r));
      if (group) group.resources.push(r);
    } else {
      moreGroup.resources.push(r);
    }
  }

  const finalGroups = [...resourceGroups.filter(g => g.resources.length > 0)];
  if (moreGroup.resources.length > 0) {
    finalGroups.push(moreGroup);
  }

  const presetKeys = Object.keys(presets);
  const presetLabels = presetKeys.map(getPresetLabel);
  const customPills = customRoles.filter((label) => !presetLabels.includes(label));
  const rolePills = [...presetLabels.map((label, i) => ({ key: presetKeys[i]!, label, preset: true })), ...customPills.map((label) => ({ key: `custom:${label}`, label, preset: false }))];

  function groupRows(group: { resources: string[] }) {
    return group.resources.map((resource) => ({
      key: resource,
      label: humanizeResource(resource),
      actions: ((resources as Record<string, string[]>)[resource] ?? []).map((action) => {
        const isPrivileged = (privileged as Record<string, string[]>)[resource]?.includes(action) ?? false;
        return {
          key: action,
          label: humanizeAction(action),
          selected: grants[resource]?.includes(action) ?? false,
          disabled: isPrivileged && !isOrgAdmin,
          disabledHint: "Admin only",
        };
      }),
    }));
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit access" : "Invite Member"}
      description={
        isEdit
          ? "Update this person's role and access permissions."
          : "Invite a client or team member and control what they can see."
      }
      submitLabel={isEdit ? "Save changes" : "Send Invite"}
      submitting={mutation.isPending}
      submitDisabled={!isEdit && email.trim().length < 3}
      error={mutation.error ? errorMessage(mutation.error) : null}
      onSubmit={handleSubmit}
      footerVariant="split"
      size="roomy"
      className="w-[min(717px,100vw)]"
      headerClassName="px-[40px] pb-[12px] pt-[40px]"
      bodyClassName="gap-0 px-[40px] pb-0 pt-[9px]"
      footerClassName="px-[40px] pb-[40px] pt-[24px]"
    >
      {/* Phase 1 — contact info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-email" className={LABEL_CLASS}>Email</label>
          {isEdit ? (
            <div className={cn(INPUT_CLASS, "flex items-center bg-surface-alt text-ink-muted")}>{email}</div>
          ) : (
            <TextInput
              id="invite-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={setEmail}
              className="h-[45px] border border-[#EEEEEE] px-4"
            />
          )}
        </div>
        {!isEdit && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-name" className={LABEL_CLASS}>
              Name <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <TextInput
              id="invite-name"
              placeholder="e.g. Sam Okonkwo"
              value={name}
              onChange={setName}
              className="h-[45px] border border-[#EEEEEE] px-4"
            />
          </div>
        )}
      </div>

      {/* Phase 2 — role selection */}
      <div className="mt-[24px] border-t border-[#F6F6F6] pt-[27px]">
        <h3 className="text-[16px] font-semibold leading-[24px] text-[#1E1E1E]">Role Presets</h3>
        <div role="group" aria-label="Role presets" className="mt-[5px] flex flex-wrap gap-x-[14px] gap-y-[16px]">
          {rolePills.map((pill) => {
            const isSelected = role === pill.label;
            return (
              <Button
                key={pill.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => (pill.preset ? handlePresetClick(pill.key) : (setRole(pill.label), setCustomDraft("")))}
                variant="outline"
                size="sm"
                className={cn(
                  "h-[24px] rounded-full border px-[8px] text-caption-m! font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
                  isSelected
                    ? "border-transparent bg-[#E6EDFD] text-primary"
                    : "border-[#EEEEEE] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]",
                )}
              >
                {pill.label}
              </Button>
            );
          })}
        </div>

        <div className="mt-[24px] flex flex-col gap-[5px]">
          <label htmlFor="invite-custom-role" className={LABEL_CLASS}>Custom Category</label>
          <div className="flex items-center gap-[8px]">
            <div className="min-w-0 flex-1">
            <TextInput
              id="invite-custom-role"
              placeholder="e.g. Lead Engineer"
              value={customDraft}
              onChange={(value) => {
                setCustomDraft(value);
                setRole(value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomRole();
                }
              }}
              className="h-[36px] w-full border border-[#EEEEEE] px-4"
            />
            </div>
            <button
              type="button"
              aria-label="Add custom role"
              onClick={addCustomRole}
              disabled={!customDraft.trim()}
              className="flex size-[36px] shrink-0 items-center justify-center bg-primary text-white outline-none transition-colors hover:bg-primary-800 focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Phase 3 — permissions */}
      <div className="mt-[24px] border-t border-[#F6F6F6] pt-[27px]">
        <h3 className="text-[16px] font-semibold leading-[24px] text-[#1E1E1E]">Permissions</h3>
        <p className="mt-[2px] text-caption-l! text-[#737373]">
          Grant specific actions for each area of the project. Selecting a preset above sets a baseline.
        </p>

        <div className="mt-[24px] flex flex-col gap-[24px]">
          {finalGroups.map((group) => (
            <PermissionGroupCard key={group.name} title={group.name} rows={groupRows(group)} onToggle={handleToggleGrant} />
          ))}
        </div>
      </div>
    </FormDrawer>
  );
}

InviteParticipantDrawer.displayName = "InviteParticipantDrawer";
