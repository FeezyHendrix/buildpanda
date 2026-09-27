import { Link, useLocation } from "react-router-dom";
import { EmptyState } from "./empty-state";

export function UnavailableDestination({ feature = false, home }: { feature?: boolean; home: string }) {
  const location = useLocation();
  return <div className="p-6" role="alert">
    <EmptyState title={feature ? "This feature is unavailable" : "Access required"}
      description={feature ? "This feature is not enabled for this workspace. Ask your administrator about availability."
        : "Your account cannot open this page. Ask your administrator for access or use the account that was invited."} />
    <p className="text-center text-sm text-ink-muted">Requested page: {location.pathname}</p>
    <div className="mt-4 text-center"><Link className="text-primary-500 underline" to={home}>Return to workspace</Link></div>
  </div>;
}
UnavailableDestination.displayName = "UnavailableDestination";
