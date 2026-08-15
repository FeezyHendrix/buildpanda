import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { FormSection } from "@/components/atoms/form-section";
import { cn } from "@/lib/utils";
import {
  ORG_MANAGEMENT_RESOURCES,
  PROJECT_RESOURCES,
  SALES_RESOURCES,
  statement,
} from "@/lib/permissions";
import { Button } from "../atoms";
import { TextInput } from "../atoms/text-input";

type Permission = Record<string, string[]>;

interface RoleBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRoleNames: string[];
  onSubmit: (input: { role: string; permission: Permission }) => void;
  isSubmitting?: boolean;
  error?: string | null;
  initial?: { role: string; permission: Permission } | null;
}

const RESOURCE_LABELS: Record<string, string> = {
  organization: "Workspace settings",
  member: "Team members",
  invitation: "Invitations",
  ac: "Roles & permissions",
  project: "Projects",
  tasks: "Tasks",
  finances: "Finances",
  schedule: "Schedule & Gantt",
  documents: "Documents",
  inspections: "Inspections",
  materials: "Materials",
  contractors: "Contractors",
  dailyLog: "Daily log",
  updates: "Updates",
  messages: "Messages",
  comments: "Comments",
  participants: "Project participants",
  teamMembers: "Workspace team",
  orgProfile: "Organization profile",
  rfis: "RFIs",
  bim: "BIM models",
  approvals: "Client approvals",
  selections: "Selections",
  queries: "Queries",
  "change-requests": "Change requests",
  "action-items": "Action items",
  "key-dates": "Key dates",
  permits: "Permits & compliance",
  risks: "Risks",
  proposals: "Proposals",
  leads: "Leads",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Create",
  read: "Read",
  update: "Update",
  delete: "Delete",
  view: "View",
  add: "Add",
  remove: "Remove",
  manage: "Manage",
  approve: "Approve",
  upload: "Upload",
  request: "Request",
  respond: "Respond",
  post: "Post",
  send: "Send",
  convert: "Convert",
  void: "Void",
  report: "Generate report",
};

const RESOURCE_GROUPS: { label: string; resources: readonly string[] }[] = [
  { label: "Workspace management", resources: ORG_MANAGEMENT_RESOURCES },
  { label: "Project workspace", resources: PROJECT_RESOURCES },
  { label: "Pre-construction", resources: SALES_RESOURCES },
];

function slugifyRoleName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function RoleBuilderDialog({
  open,
  onOpenChange,
  existingRoleNames,
  onSubmit,
  isSubmitting = false,
  error,
  initial,
}: RoleBuilderDialogProps) {
  const isEditing = initial != null;
  const [roleName, setRoleName] = useState("");
  const [permission, setPermission] = useState<Permission>({});

  useEffect(() => {
    if (!open) return;
    setRoleName(initial?.role ?? "");
    setPermission(initial?.permission ?? {});
  }, [open, initial]);

  const normalized = slugifyRoleName(roleName);
  const reservedNames = useMemo(
    () =>
      new Set(
        existingRoleNames
          .filter((name) => name.toLowerCase() !== initial?.role.toLowerCase())
          .map((name) => name.toLowerCase()),
      ),
    [existingRoleNames, initial],
  );

  const selectedCount = useMemo(
    () => Object.values(permission).reduce((sum, list) => sum + list.length, 0),
    [permission],
  );

  const nameError =
    normalized.length > 0 && reservedNames.has(normalized)
      ? "A role with this name already exists."
      : null;

  const isValid =
    normalized.length > 0 && !nameError && selectedCount > 0;

  function toggleAction(resource: string, action: string): void {
    setPermission((current) => {
      const actions = current[resource] ?? [];
      const next = actions.includes(action)
        ? actions.filter((item) => item !== action)
        : [...actions, action];
      const updated = { ...current };
      if (next.length === 0) {
        delete updated[resource];
      } else {
        updated[resource] = next;
      }
      return updated;
    });
  }

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({ role: isEditing ? initial.role : normalized, permission });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit Role Access" : "Create Custom Role"}
      description={
        isEditing
          ? "Change exactly which actions members with this role can perform."
          : "Name the role and choose exactly which actions members with this role can perform."
      }
      submitLabel={isEditing ? "Save changes" : "Create Role"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? nameError}
      onSubmit={handleSubmit}
      className="w-[min(640px,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-1.5">
        <TextInput
          label="Role Name"
          value={isEditing ? initial.role : roleName}
          onChange={setRoleName}
          disabled={isEditing}
          autoFocus={!isEditing}
          maxLength={50}
          placeholder="e.g. Site supervisor"
          className={cn('', isEditing && "cursor-not-allowed text-gray-500")}
        />
        {isEditing ? (
          <p className="text-xs text-gray-400">Role name can&rsquo;t be changed.</p>
        ) : (
          normalized.length > 0 &&
          !nameError && (
            <p className="text-xs text-gray-400">Saved as &ldquo;{normalized}&rdquo;</p>
          )
        )}
      </div>

      <div className="flex max-h-fit flex-col gap-4 overflow-y-auto pr-1">
        {RESOURCE_GROUPS.map((group) => (
          <FormSection key={group.label} title={group.label}>
            <div className="-mx-8 -my-6 divide-y divide-border">
              {group.resources.map((resource) => {
                const actions = statement[resource as keyof typeof statement] ?? [];
                const selected = permission[resource] ?? [];
                return (
                  <div
                    key={resource}
                    className="flex flex-col gap-2 px-8 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-caption-l font-medium text-grey-500">
                      {RESOURCE_LABELS[resource] ?? resource}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {actions.map((action) => {
                        const active = selected.includes(action);
                        return (
                          <Button
                            key={action}
                            variant='outline'
                            type="button"
                            onClick={() => toggleAction(resource, action)}
                            className={cn(
                              "rounded-full px-3 py-0.25 !text-caption-m font-medium transition-colors",
                              "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
                              active
                                ? "bg-primary-50 text-primary border-none"
                                : "text-gray-600 hover:bg-gray-200",
                            )}
                          >
                            {ACTION_LABELS[action] ?? action}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </FormSection>
        ))}
      </div>
    </FormDrawer>
  );
}

RoleBuilderDialog.displayName = "RoleBuilderDialog";

export { RoleBuilderDialog, type RoleBuilderDialogProps };
