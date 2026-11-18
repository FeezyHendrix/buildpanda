import { withProjectPermission } from "@/components/molecules/permission-gate";
import { goBack } from "@/lib/navigation";
import { useLocalSearchParams } from "@/navigation";
import { useMemo } from "react";
import { Spinner, Text } from "@/components/atoms";
import { DetailFields } from "@/components/molecules/schedule/detail-fields";
import { BuildingLabel } from "@/components/molecules/building-label";
import { Page } from "@/components/molecules/page";
import { useKeyDates } from "@/hooks/use-key-dates";
import { formatDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
function KeyDateDetail() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>();
    const { projectId } = useFieldSession();
    const query = useKeyDates(projectId, true, null);
    const record = useMemo(() => (query.data ?? []).find((row) => row.id === id), [query.data, id]);
    return (<Page title="Key date" onBack={() => goBack()}>
      {query.isPending && !record ? (<div className="field-stack items-center py-12">
          <Spinner size="md"/>
        </div>) : record ? (<div className="field-stack gap-4">
          <BuildingLabel buildingId={record.buildingId}/>
          <Text weight="bold" className="text-lg">
            {record.label}
          </Text>
          <DetailFields fields={[
                { label: "Status", value: record.status },
                { label: "Target date", value: formatDate(record.targetDate) },
                { label: "Actual date", value: formatDate(record.actualDate) },
                { label: "Notes", value: record.notes },
            ]}/>
        </div>) : (<div className="field-stack items-center py-12">
          <Text tone="secondary" className="text-[13px]">
            This record is no longer available.
          </Text>
        </div>)}
    </Page>);
}
export default withProjectPermission(KeyDateDetail, "/tools/schedule/key-dates/[id]");
