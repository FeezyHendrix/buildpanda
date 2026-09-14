import { Button } from "@/components/atoms/button";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs } from "@/components/molecules/filter-tabs";

export type TaskBoardScope = "assigned" | "all";
const SCOPES = [{ value: "assigned", label: "My tasks" }, { value: "all", label: "All tasks" }] as const;

interface Props {
  onCreate?: () => void;
  scope: TaskBoardScope;
  onScopeChange?: (scope: TaskBoardScope) => void;
}

export function TaskBoardHeader({ onCreate, scope, onScopeChange }: Props) {
  return <>
    <PageHeader title="Tasks" actions={onCreate ? <Button onClick={onCreate}>New task</Button> : undefined} />
    {onScopeChange ? <FilterTabs items={SCOPES} value={scope} onChange={onScopeChange} ariaLabel="Task board scope" className="mt-6" /> : null}
  </>;
}
