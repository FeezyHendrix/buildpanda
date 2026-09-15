import { Redirect, Stack } from "expo-router";
import { useAuthGate } from "@/lib/use-auth-gate";
import { useFieldSession } from "@/lib/field-session";

export default function ToolsLayout() {
  const { user, isResolving } = useAuthGate();
  const { projectId, isReady } = useFieldSession();
  if (isResolving || !isReady) return null;
  if (!user || !projectId) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
