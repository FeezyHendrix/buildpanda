import Ionicons from "@/components/atoms/icon";
import { router } from "@/navigation";
import { useState } from "react";
import { Button, Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { ICON_MUTED } from "@/constants/colors";
import { useOrganizations } from "@/hooks/use-organizations";
import { useProject } from "@/hooks/use-projects";
import { useAuthGate } from "@/lib/use-auth-gate";
import { useQueryClient } from "@tanstack/react-query";
import { signOutAndClearScope, useFieldSession } from "@/lib/field-session";
function ScopeRow({ label, value, onPress, }: {
    label: string;
    value: string | undefined;
    onPress: () => void;
}) {
    return (<button onClick={onPress} role="button" className="min-h-16 flex-row items-center border-b border-hairline px-4 active:bg-surface-alt" type="button">
      <div className="field-stack min-w-0 flex-1">
        <Text weight="semibold" tone="muted" className="text-[11px] uppercase tracking-wide">
          {label}
        </Text>
        {value === undefined ? (<div className="field-stack self-start pt-1">
            <Spinner size="xs"/>
          </div>) : (<Text weight="medium" className="pt-0.5 text-[15px]" numberOfLines={1}>
            {value}
          </Text>)}
      </div>
      <Ionicons name="chevron-forward" size={18} color={ICON_MUTED}/>
    </button>);
}
export default function Account() {
    const { user } = useAuthGate();
    const queryClient = useQueryClient();
    const { projectId, organizationId } = useFieldSession();
    const [signingOut, setSigningOut] = useState(false);
    const { data: organizations, isPending: orgsPending } = useOrganizations();
    const { data: project } = useProject(projectId);
    // Undefined while in flight: "No workspace" would be a false negative here.
    const workspaceName = orgsPending
        ? undefined
        : ((organizations ?? []).find((org) => org.id === organizationId)?.name ?? "No workspace");
    return (<Page title="Account">
      <Card>
        <div className="field-stack border-b border-hairline p-4">
          <Text weight="semibold" className="text-base">
            {user?.name ?? "Signed in"}
          </Text>
          <Text tone="secondary" className="pt-0.5 text-[13px]" numberOfLines={1}>
            {user?.email}
          </Text>
        </div>
        <ScopeRow label="Workspace" value={workspaceName} onPress={() => router.push("/select-workspace")}/>
        <ScopeRow label="Project" value={project?.name} onPress={() => router.push("/select-project")}/>
      </Card>

      <Button variant="danger" className="mt-6" loading={signingOut} onPress={async () => {
            setSigningOut(true);
            try {
                await signOutAndClearScope();
            }
            catch {
            }
            finally {
                queryClient.clear();
                setSigningOut(false);
                router.replace("/sign-in");
            }
        }}>
        Sign out
      </Button>
    </Page>);
}
