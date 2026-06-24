import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatRoleLabel } from "./utils";
import { Section } from "./section";
import type { CustomRole } from "./types";

interface RoleRowProps {
  role: CustomRole;
  canManage: boolean;
  isDeleting: boolean;
  onDelete: (role: CustomRole) => void;
}

export function RoleRow({ role, canManage, isDeleting, onDelete }: RoleRowProps) {
  const resourceCount = Object.keys(role.permission ?? {}).length;
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {formatRoleLabel(role.role)}
        </p>
        <p className="text-xs text-gray-500">
          {resourceCount} resource{resourceCount === 1 ? "" : "s"} configured
        </p>
      </div>
      {canManage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(role)}
          disabled={isDeleting}
          className="text-red-600 hover:bg-red-50"
        >
          Delete
        </Button>
      )}
    </div>
  );
}

interface RolesSectionProps {
  roles: CustomRole[];
  canManage: boolean;
  isDeleting: boolean;
  onCreate: () => void;
  onDelete: (role: CustomRole) => void;
}

export function RolesSection({
  roles,
  canManage,
  isDeleting,
  onCreate,
  onDelete,
}: RolesSectionProps) {
  const action = canManage ? (
    <Button variant="secondary" size="sm" onClick={onCreate}>
      Create role
    </Button>
  ) : null;

  if (roles.length === 0) {
    return (
      <Section title="Custom roles" action={action}>
        <div className="px-5 py-8">
          <EmptyState
            title="No custom roles yet"
            description="Create a role to grant a specific set of actions, like a site supervisor who can manage the schedule but not finances."
          />
        </div>
      </Section>
    );
  }

  return (
    <Section title="Custom roles" action={action}>
      {roles.map((role) => (
        <RoleRow
          key={role.id}
          role={role}
          canManage={canManage}
          isDeleting={isDeleting}
          onDelete={onDelete}
        />
      ))}
    </Section>
  );
}
