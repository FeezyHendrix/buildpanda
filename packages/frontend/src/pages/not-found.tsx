import { Link, useLocation, useParams } from "react-router-dom";
import { STATUS_ACTION_OUTLINE, STATUS_ACTION_PRIMARY, StatusPage } from "@/components/molecules/status-page";

/**
 * A mistyped URL is not a crash. Before this, `/schedules/chart` dropped the PM
 * into the full-screen "Something broke on site" boundary (finding F19), which
 * reads as data loss rather than a wrong address.
 */
export default function NotFound() {
  const { projectId } = useParams<{ projectId: string }>();
  const { pathname } = useLocation();
  const home = projectId ? `/project/${projectId}/overview` : "/";

  return (
    <StatusPage
      lead="Oops, we can't find"
      emphasis="that page!"
      description={
        <>
          Nothing is served at <span className="break-all font-mono text-[#404040]">{pathname}</span>. The address may
          have changed or been mistyped — your project and its records are untouched.
        </>
      }
      actions={
        <>
          <button type="button" onClick={() => window.history.back()} className={STATUS_ACTION_OUTLINE}>
            Go Back
          </button>
          <Link to={home} className={STATUS_ACTION_PRIMARY}>
            {projectId ? "Back to Overview" : "Back to Dashboard"}
          </Link>
        </>
      }
    />
  );
}
