import { type ReactNode } from "react";
import { Badge } from "@/components/atoms/badge";
import { IconBox, type IconBoxTone } from "@/components/atoms/icon-box";
import { EmptyState, type EmptyStateAction } from "./empty-state";

interface ComingSoonProps {
  icon: ReactNode;
  iconTone?: IconBoxTone;
  title: string;
  description: string;
  action?: EmptyStateAction;
}

function ComingSoon({
  icon,
  iconTone = "brand",
  title,
  description,
  action,
}: ComingSoonProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <Badge tone="info" size="md">
        Coming soon
      </Badge>
      <EmptyState
        icon={<IconBox tone={iconTone} size="lg" icon={icon} />}
        title={title}
        description={description}
        action={action}
        variant="inline"
      />
    </div>
  );
}

ComingSoon.displayName = "ComingSoon";

export { ComingSoon, type ComingSoonProps };
