import { features } from "@/lib/feature-access";
import { withProjectPermission } from "@/components/molecules/permission-gate";
import { goBack } from "@/lib/navigation";
import Ionicons from "@/components/atoms/icon";
import { router } from "@/navigation";
import { materialOrderStatusLabel } from "@/api/materials";
import { PendingBadge, Spinner, Text } from "@/components/atoms";
import { ICON_FAINT } from "@/constants/colors";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import { SearchableList } from "@/components/molecules/searchable-list";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useLocalMaterialOrders } from "@/hooks/use-local-materials";
import { useFieldSession } from "@/lib/field-session";
function List({ db, projectId }: {
    db: Db;
    projectId: string;
}) {
    const { data, isPending } = useLocalMaterialOrders(db, projectId);
    return (<SearchableList data={data} loading={isPending} fields={(row) => [
            row.title,
            row.materialName,
            row.supplier,
            materialOrderStatusLabel(row.status),
        ]} placeholder="Search materials or suppliers" emptyTitle="No material orders yet" emptyBody="Raise a request when site needs materials." renderItem={(row) => (<button key={row.id} onClick={() => router.push(`/tools/materials/${row.id}`)} role="button" className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt" type="button">
          <div className="field-stack min-w-0 flex-1">
            <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
              {row.title || row.materialName}
            </Text>
            <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
              {[`${row.quantity} ${row.unit}`, row.supplier, materialOrderStatusLabel(row.status)]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </div>
          {row.isPendingSync ? <PendingBadge /> : null}
          <Ionicons name="chevron-forward" size={18} color={ICON_FAINT}/>
        </button>)}/>);
}
function Materials() {
    const { projectId } = useFieldSession();
    const { db, ready } = useLocalDb();
    return (<Page stageScope scroll={false} title="Materials" onBack={() => goBack()} rightButtons={<HeaderIconButton permission={features.materialOrders.actions.create} icon="add" label="New material order" onPress={() => router.push("/tools/materials/new")}/>}>
      {ready && db && projectId ? (<List key={projectId} db={db} projectId={projectId}/>) : (<div className="field-stack items-center py-12">
          <Spinner size="md"/>
        </div>)}
    </Page>);
}
export default withProjectPermission(Materials, "/tools/materials");
