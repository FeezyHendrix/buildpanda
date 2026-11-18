import { features } from "@/lib/feature-access";
import { withProjectPermission } from "@/components/molecules/permission-gate";
import { goBack } from "@/lib/navigation";
import Ionicons from "@/components/atoms/icon";
import { router } from "@/navigation";
import { CHANGE_STATUS_LABELS } from "@/api/change-requests";
import { PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_FAINT } from "@/constants/colors";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import { SearchableList } from "@/components/molecules/searchable-list";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useLocalChangeRequests } from "@/hooks/use-local-change-requests";
import { useFieldSession } from "@/lib/field-session";
function List({ db, projectId }: {
    db: Db;
    projectId: string;
}) {
    const { data, isPending } = useLocalChangeRequests(db, projectId);
    return (<SearchableList data={data} loading={isPending} fields={(row) => [row.title, CHANGE_STATUS_LABELS[row.status]]} placeholder="Search change requests" emptyTitle="No change requests yet" emptyBody="Raise one when scope changes on site." renderItem={(row) => (<button key={row.id} onClick={() => router.push(`/tools/change-requests/${row.id}`)} role="button" className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt" type="button">
          <div className="field-stack min-w-0 flex-1">
            <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
              {row.title}
            </Text>
            <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
              {CHANGE_STATUS_LABELS[row.status]}
              {row.costImpact ? ` · ${row.currency} ${row.costImpact}` : ""}
              {row.timeImpactDays ? ` · ${row.timeImpactDays}d` : ""}
            </Text>
          </div>
          {row.isPendingSync ? <PendingBadge /> : null}
          <Ionicons name="chevron-forward" size={18} color={ICON_FAINT}/>
        </button>)}/>);
}
function ChangeRequests() {
    const { projectId } = useFieldSession();
    const { db, ready } = useLocalDb();
    return (<Page stageScope scroll={false} title="Change requests" onBack={() => goBack()} rightButtons={<HeaderIconButton permission={features.changeRequests.actions.create} icon="add" label="New change request" onPress={() => router.push("/tools/change-requests/new")}/>}>
      {ready && db && projectId ? (<List key={projectId} db={db} projectId={projectId}/>) : (<div className="field-stack items-center py-12">
          <Spinner size="md"/>
        </div>)}
    </Page>);
}
export default withProjectPermission(ChangeRequests, "/tools/change-requests");
