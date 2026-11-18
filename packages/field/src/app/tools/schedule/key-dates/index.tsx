import { withProjectPermission } from "@/components/molecules/permission-gate";
import { KeyDateRow } from "@/components/molecules/schedule/rows";
import { router } from "@/navigation";
import { ScheduleListScreen } from "@/components/molecules/schedule/list-screen";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useFieldSession } from "@/lib/field-session";
function KeyDates() {
    const { projectId } = useFieldSession();
    const keyDates = useKeyDates(projectId);
    const data = keyDates.data ?? [];
    return (<ScheduleListScreen title="Key dates" isPending={keyDates.isPending} isStale={keyDates.isStale} key={projectId} data={data} fields={(keyDate) => [keyDate.label, keyDate.status, keyDate.notes, keyDate.targetDate]} emptyTitle="No key dates" emptyBody="Milestone and compliance dates for this project will appear here." renderItem={(keyDate) => (<button key={keyDate.id} onClick={() => router.push(`/tools/schedule/key-dates/${keyDate.id}` as never)} role="button" type="button">
          <KeyDateRow keyDate={keyDate}/>
        </button>)}/>);
}
export default withProjectPermission(KeyDates, "/tools/schedule/key-dates");
