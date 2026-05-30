import { type ReactNode } from "react";
import { Badge } from "@/components/atoms/badge";
import { IconBox, type IconBoxTone } from "@/components/atoms/icon-box";
import { EmptyState } from "./empty-state";

interface ComingSoonProps {
  icon: ReactNode;
  iconTone?: IconBoxTone;
  title: string;
  description: string;
  action?: ReactNode;
}

function ComingSoon({
  icon,
  iconTone = "brand",
  title,
  description,
  action,
}: ComingSoonProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-20">
      <EmptyState
        icon={<IconBox tone={iconTone} size="lg" icon={icon} />}
        title={title}
        description={description}
        action={
          <div className="flex flex-col items-center gap-3">
            <Badge tone="info" size="md">
              Coming soon
            </Badge>
            {action}
          </div>
        }
      />
    </div>
  );
}

ComingSoon.displayName = "ComingSoon";

export { ComingSoon, type ComingSoonProps };
