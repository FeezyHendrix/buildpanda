export interface NarrativeReference {
  update_is_draft?: boolean;
  project_id: string;
  resource: string;
  action: string;
  visibility?: string | null;
  is_proposed_response?: boolean | null;
  task_id?: string | null;
  task_assigned?: boolean | null;
  task_created_by_id?: string | null;
  expense_id?: string | null;
  expense_created_by_id?: string | null;
}

export interface NarrativeSource {
  table: string;
  resource: string;
  action?: string;
  parent?: readonly [table: string, foreignKey: string];
  kind?: string;
  direction?: string;
  live?: boolean;
}
