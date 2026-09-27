import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";

export function ImportProgress({ projectId, onRestart }: { projectId: string | null; onRestart: () => void }) {
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div className="text-sm text-ink-muted">
      <p>Your progress is saved in this tab.</p>
      {projectId ? <Link className="text-primary-500 underline" to={`/project/${projectId}/overview`}>Open the project already created</Link> : null}
    </div>
    <Button variant="secondary" onClick={onRestart}>Start another import</Button>
  </div>;
}
