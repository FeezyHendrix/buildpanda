import { goBack } from "@/lib/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signOutAndClearScope, useFieldSession } from "@/lib/field-session";
import { Button } from "@/components/atoms";
import { useState } from "react";
import { router } from "expo-router";
import { PickerScreen, type PickerItem } from "@/components/molecules/picker-screen";
import { useOrganizations, useSetActiveOrganization } from "@/hooks/use-organizations";
import { useSession } from "@/lib/auth-client";

export default function SelectWorkspace() {
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const { projectId, organizationId } = useFieldSession();
  const { data: session } = useSession();
  const activeOrgId = session?.session.activeOrganizationId ?? organizationId;
  const [busyId, setBusyId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const { data, isPending, error: loadError, isStale, refetch } = useOrganizations();
  const setActive = useSetActiveOrganization();

  const items: PickerItem[] = (data ?? []).map((org) => ({ id: org.id, label: org.name }));

  async function handleSelect(id: string) {
    if (busyId) return;
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
      onBack={projectId ? goBack : undefined}
      description="Field Tools shows the projects in the workspace you pick here."
      items={items}
      activeId={activeOrgId}
      loading={isPending}
      busyId={busyId}
      errorMessage={error ?? (loadError && !data ? loadError.message : undefined)}
      isStale={isStale}
      onRetry={() => { void refetch(); }}
      searchPlaceholder="Search workspaces"
      otherLabel="OTHER WORKSPACES"
      emptyTitle="No workspaces yet"
      emptyDescription="You're not a member of any workspace. Ask an admin to invite you, then sign in again."
      onSelect={handleSelect}
      footer={!isPending && !items.length ? (
        <Button variant="secondary" loading={signingOut} onPress={async () => {
          setSigningOut(true);
          try { await signOutAndClearScope(); }
          catch { /* Local sign-out succeeds even without a connection. */ }
          finally { queryClient.clear(); setSigningOut(false); router.replace("/sign-in"); }
        }}>Back to sign in</Button>
      ) : undefined}
    />
  );
}
