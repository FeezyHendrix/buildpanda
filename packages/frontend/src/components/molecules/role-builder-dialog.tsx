import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";
import {
  ORG_MANAGEMENT_RESOURCES,
  PROJECT_RESOURCES,
  statement,
} from "@/lib/permissions";

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
  post: "Post",
  send: "Send",
  void: "Void",
  report: "Generate report",
};

const RESOURCE_GROUPS: { label: string; resources: readonly string[] }[] = [
  { label: "Workspace management", resources: ORG_MANAGEMENT_RESOURCES },
  { label: "Project workspace", resources: PROJECT_RESOURCES },
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
      title={isEditing ? "Edit role access" : "Create a custom role"}
      description={
        isEditing
          ? "Change exactly which actions members with this role can perform."
          : "Name the role and choose exactly which actions members with this role can perform."
      }
      submitLabel={isEditing ? "Save changes" : "Create role"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? nameError}
      onSubmit={handleSubmit}
      className="w-[min(640px,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role-name">Role name</Label>
        <input
          id="role-name"
          value={isEditing ? initial.role : roleName}
          onChange={(e) => setRoleName(e.target.value)}
          disabled={isEditing}
          autoFocus={!isEditing}
          maxLength={50}
          placeholder="e.g. Site supervisor"
          className={cn(
            "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10",
            isEditing && "cursor-not-allowed text-gray-500",
          )}
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

      <div className="flex max-h-[46vh] flex-col gap-5 overflow-y-auto pr-1">
        {RESOURCE_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {group.label}
            </p>
            {group.resources.map((resource) => {
              const actions = statement[resource as keyof typeof statement] ?? [];
              const selected = permission[resource] ?? [];
              return (
                <div
                  key={resource}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {RESOURCE_LABELS[resource] ?? resource}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {actions.map((action) => {
                      const active = selected.includes(action);
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => toggleAction(resource, action)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                            "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
                            active
                              ? "bg-[#004DE7] text-white"
                              : "bg-[#F6F6F6] text-gray-600 hover:bg-gray-200",
                          )}
                        >
                          {ACTION_LABELS[action] ?? action}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </FormDrawer>
  );
}

RoleBuilderDialog.displayName = "RoleBuilderDialog";

export { RoleBuilderDialog, type RoleBuilderDialogProps };
