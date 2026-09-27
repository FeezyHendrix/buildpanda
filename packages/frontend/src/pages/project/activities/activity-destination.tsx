import { Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import type { Activity } from "@/lib/project-types";

interface Props {
  projectId: string;
  activity?: Activity;
  onEdit?: () => void;
}

export function ActivityDestination({ projectId, activity, onEdit }: Props) {
  const back = `/project/${projectId}/schedules/activities`;
  return <Card className="my-4 p-5">
    <Link to={back} className="text-sm text-primary-500 underline">All activities</Link>
    {activity ? <>
      <h2 className="mt-3 text-lg font-semibold">{activity.name}</h2>
      <p className="my-3 text-sm text-ink-muted">Status: {activity.status}</p>
      {onEdit ? <Button onClick={onEdit}>Update activity</Button> : null}
    </> : <EmptyState variant="inline" title="Activity unavailable" description="This activity could not be opened. It may have been removed or your access may have changed. Return to the activity list to continue." />}
  </Card>;
}
