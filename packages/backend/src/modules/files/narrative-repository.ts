import type { Knex } from 'knex';
import type { NarrativeReference, NarrativeSource } from './narrative-types.ts';

/** Each record keeps its existing read policy; all of its narrative fields share it. */
const SOURCES: readonly NarrativeSource[] = [
  { table: 'project_finances', resource: 'finances' },
  { table: 'payment_claims', resource: 'finances' }, { table: 'payment_ledger', resource: 'finances' },
  { table: 'extension_of_time_claims', resource: 'schedule' },
  { table: 'document_versions', parent: ['project_documents', 'document_id'], resource: 'documents' },
  { table: 'bim_coordination_issues', parent: ['bim_models', 'bim_model_id'], resource: 'bim' },
  { table: 'project_updates', resource: 'updates' },
  { table: 'update_comments', parent: ['project_updates', 'update_id'], resource: 'updates' },
  { table: 'daily_logs', resource: 'dailyLog' }, { table: 'daily_log_entries', resource: 'dailyLog' },
  { table: 'daily_log_entry_voids', parent: ['daily_log_entries', 'entry_id'], resource: 'dailyLog' },
  { table: 'daily_log_templates', resource: 'dailyLog' },
  { table: 'rfis', resource: 'rfis' }, { table: 'rfi_comments', parent: ['rfis', 'rfi_id'], resource: 'rfis' },
  { table: 'tasks', resource: 'tasks' }, { table: 'task_comments', parent: ['tasks', 'task_id'], resource: 'tasks' },
  { table: 'action_items', resource: 'tasks' }, { table: 'action_item_comments', parent: ['action_items', 'action_item_id'], resource: 'tasks' },
  { table: 'change_requests', resource: 'change-requests' },
  { table: 'change_request_comments', parent: ['change_requests', 'change_request_id'], resource: 'change-requests' },
  ...['client', 'material'].flatMap((kind): NarrativeSource[] => [
    { table: 'approvals', resource: kind === 'material' ? 'materials' : 'approvals', kind },
    { table: 'approval_comments', parent: ['approvals', 'approval_id'], resource: kind === 'material' ? 'materials' : 'approvals', kind },
  ]),
  { table: 'material_approval_details', parent: ['approvals', 'approval_id'], resource: 'materials' },
  { table: 'material_orders', resource: 'materials' }, { table: 'material_deliveries', resource: 'materials' },
  { table: 'material_ledger_entries', resource: 'materials' }, { table: 'equipment_requests', resource: 'materials' },
  { table: 'suppliers', resource: 'materials' }, { table: 'activities', resource: 'schedule' },
  { table: 'activity_delays', parent: ['activities', 'activity_id'], resource: 'schedule' },
  { table: 'look_aheads', resource: 'schedule' }, { table: 'key_dates', resource: 'key-dates' },
  { table: 'inspections', resource: 'inspections' }, { table: 'permits', resource: 'permits' },
  { table: 'risk_factors', resource: 'risks' }, { table: 'method_statements', resource: 'risks' },
  { table: 'construction_phase_plans', resource: 'risks' },
  { table: 'team_members', resource: 'teamMembers' },
  { table: 'project_selections', resource: 'selections' },
  { table: 'project_selection_options', parent: ['project_selections', 'selection_id'], resource: 'selections' },
  { table: 'project_transactions', resource: 'finances', action: 'viewCosts' },
  { table: 'project_budget_categories', resource: 'finances', action: 'viewCosts' },
  { table: 'project_budget_periods', resource: 'finances', action: 'viewCosts' },
  { table: 'purchase_orders', resource: 'finances', action: 'viewCosts' },
  { table: 'purchase_order_items', parent: ['purchase_orders', 'purchase_order_id'], resource: 'finances', action: 'viewCosts' },
  { table: 'cash_flow_entries', resource: 'finances', action: 'viewCosts' },
  { table: 'milestone_disputes', parent: ['milestone_payments', 'milestone_id'], resource: 'finances' },
  ...['payable', 'receivable'].flatMap((direction): NarrativeSource[] => [
    { table: 'project_invoices', resource: 'finances', action: direction === 'payable' ? 'viewCosts' : 'view', direction },
    { table: 'project_invoice_line_items', parent: ['project_invoices', 'invoice_id'], resource: 'finances', action: direction === 'payable' ? 'viewCosts' : 'view', direction },
    { table: 'invoice_payments', parent: ['project_invoices', 'invoice_id'], resource: 'finances', action: direction === 'payable' ? 'viewCosts' : 'view', direction },
    { table: 'invoice_events', parent: ['project_invoices', 'invoice_id'], resource: 'finances', action: direction === 'payable' ? 'viewCosts' : 'view', direction },
  ]),
  { table: 'drawing_markup_comments', parent: ['drawing_markups', 'markup_id'], resource: 'documents', live: true },
];

function referencePattern(fileId: string) {
  return `%/files/${fileId.replace(/[\\%_]/g, '\\$&')}/download%`;
}

export async function narrativeProjectReferences(db: Knex, fileId: string, userId: string, projectId?: string): Promise<NarrativeReference[]> {
  const queries = SOURCES.map((source) => {
    const alias = source.parent ? 'c' : 'p';
    const parent = source.parent?.[0] ?? source.table;
    const query = db(`${source.table} as ${alias}`);
    if (source.parent) query.join(`${source.parent[0]} as p`, 'p.id', `c.${source.parent[1]}`);
    query.whereNotNull('p.project_id').whereRaw('to_jsonb(??)::text LIKE ?', [alias, referencePattern(fileId)]);
    if (projectId) query.where('p.project_id', projectId);
    if (source.kind) query.where('p.kind', source.kind);
    if (source.direction) query.where('p.direction', source.direction);
    if (source.live) query.whereNull('c.deleted_at').whereNull('p.deleted_at');
    const task = parent === 'tasks';
    return query.select('p.project_id', db.raw('?::text as resource', [source.resource]), db.raw('?::text as action', [source.action ?? 'view']),
      parent === 'rfis' ? 'p.visibility' : db.raw('NULL::text as visibility'),
      source.table === 'rfi_comments' ? 'c.is_proposed_response' : db.raw('false as is_proposed_response'),
      task ? db.raw('p.id as task_id') : db.raw('NULL::text as task_id'),
      task ? db.raw('EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = p.id AND a.assignee_id = ?) as task_assigned', [userId]) : db.raw('false as task_assigned'));
  });
  return db.unionAll(queries, true);
}

export async function narrativeOrganizationReferences(db: Knex, fileId: string): Promise<{ organizationId: string; resource: string; action: string }[]> {
  const direct = [
    ['leads', 'org_id', 'leads'], ['proposals', 'org_id', 'proposals'],
    ['proposal_templates', 'org_id', 'proposals'], ['precon_assemblies', 'org_id', 'takeoffs'],
    ['precon_compliance_docs', 'org_id', 'complianceDocs'], ['precon_quote_sources', 'org_id', 'rateCards'], ['organization', 'id', 'orgProfile'],
    ['suppliers', 'organization_id', 'materials'], ['daily_log_templates', 'organization_id', 'dailyLog'],
  ] as const;
  const proposalChildren = [
    ['proposal_comments', 'proposals'], ['proposal_pack_sections', 'proposals'], ['estimates', 'proposals'],
    ['risk_factors', 'proposals'], ['method_statements', 'proposals'], ['construction_phase_plans', 'proposals'],
    ['proposal_boq_items', 'proposals'],
  ] as const;
  const queries = direct.map(([table, column, resource]) => db(`${table} as p`).whereNotNull(`p.${column}`)
    .whereRaw('to_jsonb(p)::text LIKE ?', [referencePattern(fileId)])
    .select(`p.${column} as organizationId`, db.raw('?::text as resource', [resource]), db.raw("'view'::text as action")));
  queries.push(...proposalChildren.map(([table, resource]) => db(`${table} as c`).join('proposals as p', 'p.id', 'c.proposal_id')
    .whereRaw('to_jsonb(c)::text LIKE ?', [referencePattern(fileId)])
    .select('p.org_id as organizationId', db.raw('?::text as resource', [resource]), db.raw("'view'::text as action"))));
  for (const table of ['estimate_items', 'estimate_payment_schedule']) {
    queries.push(db(`${table} as c`).join('estimates as e', 'e.id', 'c.estimate_id').join('proposals as p', 'p.id', 'e.proposal_id')
      .whereRaw('to_jsonb(c)::text LIKE ?', [referencePattern(fileId)])
      .select('p.org_id as organizationId', db.raw("'proposals'::text as resource"), db.raw("'view'::text as action")));
  }
  queries.push(db('precon_boq_rows as c').join('precon_bills as b', 'b.id', 'c.bill_id').join('precon_sessions as p', 'p.id', 'b.session_id')
    .whereNull('c.deleted_at').whereNotNull('p.org_id').whereRaw('to_jsonb(c)::text LIKE ?', [referencePattern(fileId)])
    .select('p.org_id as organizationId', db.raw("'takeoffs'::text as resource"), db.raw("'view'::text as action")));
  queries.push(db('drawing_markup_comments as c').join('drawing_markups as m', 'm.id', 'c.markup_id').join('precon_sessions as p', 'p.id', 'm.precon_session_id')
    .whereNull('c.deleted_at').whereNull('m.deleted_at').whereNotNull('p.org_id').whereRaw('to_jsonb(c)::text LIKE ?', [referencePattern(fileId)])
    .select('p.org_id as organizationId', db.raw("'takeoffs'::text as resource"), db.raw("'view'::text as action")));
  queries.push(db('precon_rate_buildups as c').join('precon_rates as r', 'r.id', 'c.rate_id').join('precon_rate_cards as p', 'p.id', 'r.rate_card_id')
    .whereRaw('to_jsonb(c)::text LIKE ?', [referencePattern(fileId)])
    .select('p.org_id as organizationId', db.raw("'rateCards'::text as resource"), db.raw("'view'::text as action")));
  return db.unionAll(queries, true);
}
