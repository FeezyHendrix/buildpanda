export interface NarrativeReference {
  project_id: string;
  resource: string;
  action: string;
  visibility?: string | null;
  is_proposed_response?: boolean | null;
  task_id?: string | null;
  task_assigned?: boolean | null;
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
