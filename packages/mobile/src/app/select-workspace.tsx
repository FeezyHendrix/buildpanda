import { useState } from "react";
import { router } from "expo-router";
import { PickerScreen, type PickerItem } from "@/components/molecules/picker-screen";
import { useOrganizations, useSetActiveOrganization } from "@/hooks/use-organizations";
import { useSession } from "@/lib/auth-client";

export default function SelectWorkspace() {
  const { data: session } = useSession();
  const activeOrgId = session?.session.activeOrganizationId ?? undefined;
  const [busyId, setBusyId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const { data, isPending } = useOrganizations();
  const setActive = useSetActiveOrganization();

  const items: PickerItem[] = (data ?? []).map((org) => ({ id: org.id, label: org.name }));

  async function handleSelect(id: string) {
    setError(undefined);
    if (id === activeOrgId) {
      router.replace("/select-project");
      return;
    }
    setBusyId(id);
    try {
      await setActive.mutateAsync(id);
      router.replace("/select-project");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch workspace.");
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <PickerScreen
      title="Choose a workspace"
      description="Field Tools shows the projects in the workspace you pick here."
      items={items}
      activeId={activeOrgId}
      loading={isPending}
      busyId={busyId}
      errorMessage={error}
      searchPlaceholder="Search workspaces"
      otherLabel="OTHER WORKSPACES"
      emptyTitle="No workspaces yet"
      emptyDescription="You're not a member of any workspace. Ask an admin to invite you, then sign in again."
      onSelect={handleSelect}
    />
  );
}
