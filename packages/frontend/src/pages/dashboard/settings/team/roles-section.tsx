import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatRoleLabel } from "./utils";
import { Section } from "./section";
import type { CustomRole } from "./types";
import { cn } from "@/lib/utils";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";

interface RoleRowProps {
  role: CustomRole;
  canManage: boolean;
  isDeleting: boolean;
  onEdit: (role: CustomRole) => void;
  onDelete: (role: CustomRole) => void;
}

export function RoleRow({ role, canManage, isDeleting, onEdit, onDelete }: RoleRowProps) {
  const resourceCount = Object.keys(role.permission ?? {}).length;
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption-l font-medium text-black-500">
          {formatRoleLabel(role.role)}
        </p>
        <p className="text-caption-l font-medium text-grey-450">
          {resourceCount} resource{resourceCount === 1 ? "" : "s"} configured
        </p>
      </div>
      {canManage && (
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="md" 
            onClick={() => onEdit(role)} 
            className="font-medium"
          >
            Edit
          </Button>
          <Button
            variant="danger-outline"
            size="md"
            onClick={() => onDelete(role)}
            disabled={isDeleting}
            className="font-medium"
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

interface RolesSectionProps {
  roles: CustomRole[];
  canManage: boolean;
  isDeleting: boolean;
  onCreate: () => void;
  onEdit: (role: CustomRole) => void;
  onDelete: (role: CustomRole) => void;
}

export function RolesSection({
  roles,
  canManage,
  isDeleting,
  onCreate,
  onEdit,
  onDelete,
}: RolesSectionProps) {
  const action = canManage ? (
    <Button variant="ghost" size="md" onClick={onCreate} className={cn('!text-primary text-caption-l !font-semibold')}>
      <ReactSVG src={icons2.plus} className='[&_svg]:size-[14px] [&_path]:fill-primary shrink-0' />
      Create Role
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
    <Section title="Roles" action={action}>
      {roles.map((role) => (
        <RoleRow
          key={role.id}
          role={role}
          canManage={canManage}
          isDeleting={isDeleting}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </Section>
  );
}
