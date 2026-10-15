import { DailyLogPage } from "@/components/daily-log/daily-log-page";
import { withProjectPermission } from "@/components/molecules/permission-gate";

function NewDailyLog() { return <DailyLogPage creating />; }

export default withProjectPermission(NewDailyLog, "/tools/daily-log/new");
