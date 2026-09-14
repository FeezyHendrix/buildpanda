import { Link, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";

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
    <div className="flex w-full flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">404</p>
      <h1 className="text-2xl font-semibold text-gray-900">This page does not exist</h1>
      <p className="max-w-md text-sm text-gray-500">
        Nothing is served at <span className="font-mono text-gray-700">{pathname}</span>. The address may
        have changed, or the link may be mistyped — the project and its records are untouched.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link to={home}>
          <Button variant="primary" size="md">
            {projectId ? "Back to the project overview" : "Back to the dashboard"}
          </Button>
        </Link>
        <Button variant="secondary" size="md" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    </div>
  );
}
