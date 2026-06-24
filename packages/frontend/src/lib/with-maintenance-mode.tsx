import type { ComponentType } from "react";
import { useMaintenanceStatus } from "@/hooks/use-maintenance";
import { MaintenancePage } from "@/components/organisms/maintenance-page";

export function withMaintenanceMode<P extends object>(Wrapped: ComponentType<P>): ComponentType<P> {
  function WithMaintenanceMode(props: P) {
    const { data } = useMaintenanceStatus();

    if (data && data.enabled && !data.allowed) {
      return <MaintenancePage message={data.message} />;
    }

    return <Wrapped {...props} />;
  }

  WithMaintenanceMode.displayName = `withMaintenanceMode(${Wrapped.displayName || Wrapped.name || "Component"})`;
  return WithMaintenanceMode;
}
