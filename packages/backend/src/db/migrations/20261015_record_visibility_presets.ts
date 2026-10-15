import type { Knex } from "knex";

// Frozen pre-change preset. Only untouched presets gain the new explicit grants;
// custom maps, empty overrides and other roles retain their exact permissions.
const previous = {
    project: ["view"],
    tasks: ["view", "add", "remove"],
    finances: ["view", "viewCosts"],
    schedule: ["view", "manage"],
    documents: ["view", "upload"],
    inspections: ["view", "request", "manage"],
    materials: ["view", "manage", "report", "request"],
    contractors: ["view"],
    dailyLog: ["view", "create", "report"],
    updates: ["view", "post"],
    messages: ["view", "send"],
    comments: ["view", "post"],
    participants: ["view"],
    teamMembers: ["view"],
    stages: ["view"],
    buildings: ["view", "manage"],
    "key-dates": ["view", "manage"],
    rfis: ["view", "create", "respond", "manage"],
    approvals: ["view"],
    selections: ["view"],
    "change-requests": ["view", "manage"],
    permits: ["view", "manage"],
    risks: ["view", "manage"],
    bim: ["view", "upload"],
  };
const next = { ...previous, tasks: [...previous.tasks, "viewAll"], finances: [...previous.finances, "viewAllExpenses"] };

export async function up(db: Knex): Promise<void> {
  await db("project_participants").where({ role: "project_manager" })
    .whereRaw("grants = ?::jsonb", [JSON.stringify(previous)])
    .update({ grants: JSON.stringify(next) });
}

export async function down(db: Knex): Promise<void> {
  await db("project_participants").where({ role: "project_manager" })
    .whereRaw("grants = ?::jsonb", [JSON.stringify(next)])
    .update({ grants: JSON.stringify(previous) });
}
