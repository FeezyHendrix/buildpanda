import { PreconProgrammePanel } from "@/components/molecules/precon-programme-panel";

interface Props {
  sessionId: string;
  sessionTitle: string;
}

/**
 * Stand-in for the programme step until the full task editor and chart view
 * land (workstream WS-1 replaces this component). Renders the existing
 * programme panel so the step is never a dead end.
 */
export function ProgrammeStepPlaceholder({ sessionId, sessionTitle }: Props) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
      <PreconProgrammePanel sessionId={sessionId} sessionTitle={sessionTitle} />
    </div>
  );
}
ProgrammeStepPlaceholder.displayName = "ProgrammeStepPlaceholder";
