import { Redirect } from "expo-router";
import { View } from "react-native";
import { Spinner } from "@/components/atoms";
import { useFieldSession } from "@/lib/field-session";
import { useAuthGate } from "@/lib/use-auth-gate";

/**
 * Entry gate: signed in -> workspace -> project -> tools.
 *
 * Reads the cached identity, not the live session, so a cold start with no
 * signal lands straight in the tools instead of bouncing to sign-in.
 * Presentation only; the backend still enforces access on every request.
 */
export default function Index() {
  const { user, isResolving } = useAuthGate();
  const { organizationId, projectId, isReady } = useFieldSession();

  if (isResolving || !isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Spinner size="lg" />
      </View>
    );
  }

  if (!user) return <Redirect href="/sign-in" />;
  if (!organizationId) return <Redirect href="/select-workspace" />;
  if (!projectId) return <Redirect href="/select-project" />;
  return <Redirect href="/(tabs)" />;
}
