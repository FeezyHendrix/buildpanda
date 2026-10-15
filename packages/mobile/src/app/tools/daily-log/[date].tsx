import { DailyLogPage } from "@/components/daily-log/daily-log-page";
import { withProjectPermission } from "@/components/molecules/permission-gate";

export default withProjectPermission(DailyLogPage, "/tools/daily-log/[date]");
