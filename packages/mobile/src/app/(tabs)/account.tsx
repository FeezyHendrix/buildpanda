import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Button, Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { useOrganizations } from "@/hooks/use-organizations";
import { useProject } from "@/hooks/use-projects";
import { useSession } from "@/lib/auth-client";
import { signOutAndClearScope, useFieldSession } from "@/lib/field-session";

function ScopeRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-16 flex-row items-center border-b border-hairline px-4 active:bg-surface-alt"
    >
      <View className="min-w-0 flex-1">
        <Text weight="semibold" tone="muted" className="text-[11px] uppercase tracking-wide">
          {label}
        </Text>
        {value === undefined ? (
          <View className="self-start pt-1">
            <Spinner size="xs" />
          </View>
        ) : (
          <Text weight="medium" className="pt-0.5 text-[15px]" numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#888888" />
    </Pressable>
  );
}

export default function Account() {
  const { data: session } = useSession();
  const { projectId, organizationId } = useFieldSession();

  const { data: organizations, isPending: orgsPending } = useOrganizations();
  const { data: project } = useProject(projectId);

  // Undefined while in flight: "No workspace" would be a false negative here.
  const workspaceName = orgsPending
    ? undefined
    : ((organizations ?? []).find((org) => org.id === organizationId)?.name ?? "No workspace");

  return (
    <Page title="Account">
      <Card>
        <View className="border-b border-hairline p-4">
          <Text weight="semibold" className="text-base">
            {session?.user.name ?? "Signed in"}
          </Text>
          <Text tone="secondary" className="pt-0.5 text-[13px]" numberOfLines={1}>
            {session?.user.email}
          </Text>
        </View>
        <ScopeRow
          label="Workspace"
          value={workspaceName}
          onPress={() => router.push("/select-workspace")}
        />
        <ScopeRow
          label="Project"
          value={project?.name}
          onPress={() => router.push("/select-project")}
        />
      </Card>

      <Button variant="danger" className="mt-6" onPress={() => void signOutAndClearScope()}>
        Sign out
      </Button>
    </Page>
  );
}
