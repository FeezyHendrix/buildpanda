import { EmptyState } from "./empty-state";

interface UnavailableRecordProps {
  name: string;
  returnLabel: string;
  onReturn: () => void;
}

export function UnavailableRecord({ name, returnLabel, onReturn }: UnavailableRecordProps) {
  return <div role="alert">
    <EmptyState variant="inline" title={`${name} unavailable`}
      description={`This ${name.toLowerCase()} may have been removed or is no longer available in this project.`}
      action={{ label: returnLabel, onClick: onReturn }} />
  </div>;
}

UnavailableRecord.displayName = "UnavailableRecord";
