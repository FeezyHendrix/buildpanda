import type { ComponentType, ReactNode } from "react";
import { router } from "expo-router";
import { Button, Spinner, Text } from "@/components/atoms";
import { Page } from "./page";
import { useProjectAccess } from "@/lib/project-access-provider";
import { refreshProjectAccess } from "@/lib/project-access-store";
import { routePermission } from "@/lib/mobile-routes";
import type { AccessRequirement } from "@/lib/access-requirement";

export function PermissionGate({ permission, when = true, children }: { permission: AccessRequirement; when?: boolean; children: ReactNode }) {
  const { allows } = useProjectAccess();
  return when && allows(permission) ? children : null;
}

export function AccessUnavailable() {
  const { status } = useProjectAccess();
  return <Page title="Project access" showSync={false}>
    {status === "loading" ? <Spinner /> : null}
    <Text className="py-4">{status === "ready" ? "You do not have permission to open this view." : "Connect to verify your project permissions. Offline access lasts up to 24 hours after verification."}</Text>
    <Button onPress={() => { void refreshProjectAccess(); }}>Refresh access</Button>
    <Button variant="ghost" onPress={() => router.replace("/select-project")}>Choose a project</Button>
    <Button variant="ghost" onPress={() => router.replace("/(tabs)/account")}>Account</Button>
  </Page>;
}

/** The child never mounts (or reads its cache) until the route is authorized. */
export function withProjectPermission(Screen: ComponentType, path: string) {
  const policy = routePermission(path);
  return function ProtectedScreen() {
    const { allows, generation } = useProjectAccess();
    if (!allows(policy)) return <AccessUnavailable />;
    return <Screen key={generation} />;
  };
}
