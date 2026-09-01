import { KeyDateRow } from "@/components/molecules/schedule/rows";
import { ScheduleListScreen } from "@/components/molecules/schedule/list-screen";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useFieldSession } from "@/lib/field-session";

export default function KeyDates() {
  const { projectId } = useFieldSession();
  const keyDates = useKeyDates(projectId);
  const data = keyDates.data ?? [];

  return (
    <ScheduleListScreen
      title="Key Dates"
      isPending={keyDates.isPending}
      isStale={keyDates.isStale}
      isEmpty={data.length === 0}
      emptyTitle="No key dates"
      emptyBody="Milestone and compliance dates for this project will appear here."
    >
      {data.map((keyDate) => (
        <KeyDateRow key={keyDate.id} keyDate={keyDate} />
      ))}
    </ScheduleListScreen>
  );
}
