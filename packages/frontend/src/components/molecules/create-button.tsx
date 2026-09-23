import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/atoms/button";
import { PlusIcon } from "@/components/atoms/project-nav-icons";

/**
 * The one "create" button. Every page- or panel-level action that opens a
 * create flow — new task, add supplier, raise RFI, upload a plan, record an
 * expense — renders through this so the affordance is identical everywhere: a
 * primary button led by a plain plus. Never hand a create action its own icon.
 */
const CreateButton = forwardRef<HTMLButtonElement, ButtonProps>(({ children, ...props }, ref) => (
  <Button ref={ref} {...props}>
    <PlusIcon className="size-4" />
    {children}
  </Button>
));

CreateButton.displayName = "CreateButton";

export { CreateButton };
