import type { Knex } from "knex";

const DAYS = 60;
const DEMO_PREFIX = "demo_metrics_";
const MODELS = ["gpt-4o-mini", "kimi-k2-0905-preview", "gpt-4o-2024-08-06"];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

export async function seed(knex: Knex): Promise<void> {
  await knex("llm_calls").where("id", "like", `${DEMO_PREFIX}%`).del();
  await knex("takeoff_jobs").where("id", "like", `${DEMO_PREFIX}%`).del();
  await knex("proposals").where("id", "like", `${DEMO_PREFIX}%`).del();
  await knex("session").where("id", "like", `${DEMO_PREFIX}%`).del();
  await knex("member").where("userId", "like", `${DEMO_PREFIX}%`).del();
  await knex("user").where("id", "like", `${DEMO_PREFIX}%`).del();
  await knex("organization").where("id", "like", `${DEMO_PREFIX}%`).del();

  const orgs = Array.from({ length: 6 }, (_, i) => ({
    id: `${DEMO_PREFIX}org_${i}`,
    name: `Demo Org ${i + 1}`,
    slug: `${DEMO_PREFIX}org-${i}`,
    createdAt: daysAgo(DAYS - i * 3),
    updatedAt: daysAgo(0),
  }));
  await knex("organization").insert(orgs);

  const proposals = orgs.map((org, i) => ({
    id: `${DEMO_PREFIX}prop_${i}`,
    org_id: org.id,
    number: 1000 + i,
    title: `Demo Proposal ${i + 1}`,
    client_name: `Demo Client ${i + 1}`,
    created_by: `${DEMO_PREFIX}user_${i}`,
    created_at: daysAgo(DAYS - i * 2 - 1),
  }));

  const users: Array<Record<string, unknown>> = [];
  const members: Array<Record<string, unknown>> = [];
  const sessions: Array<Record<string, unknown>> = [];
  let userSeq = 0;

  for (let day = DAYS; day >= 0; day -= 1) {
    const signupsToday = 1 + ((DAYS - day) % 5);
    for (let s = 0; s < signupsToday; s += 1) {
      const id = `${DEMO_PREFIX}user_${userSeq}`;
      const createdAt = daysAgo(day);
      const activeDays = (userSeq % 4) + 1;
      const lastActiveDay = Math.max(0, day - (activeDays - 1));
      users.push({
        id,
        name: `Demo User ${userSeq}`,
        email: `${DEMO_PREFIX}user${userSeq}@example.com`,
        emailVerified: true,
        createdAt,
        updatedAt: createdAt,
        last_activity_at: daysAgo(lastActiveDay),
      });
      const org = pick(orgs, userSeq);
      members.push({
        id: `${DEMO_PREFIX}mem_${userSeq}`,
        userId: id,
        organizationId: org.id,
        role: "member",
        createdAt,
      });
      for (let a = 0; a < activeDays && day - a >= 0; a += 1) {
        sessions.push({
          id: `${DEMO_PREFIX}sess_${userSeq}_${a}`,
          userId: id,
          token: `${DEMO_PREFIX}tok_${userSeq}_${a}`,
          expiresAt: daysAgo(day - a - 1),
          createdAt: daysAgo(day - a),
          updatedAt: daysAgo(day - a),
        });
      }
      userSeq += 1;
    }
  }
  await knex("user").insert(users);
  await knex("member").insert(members);
  await knex("proposals").insert(proposals);
  for (let i = 0; i < sessions.length; i += 500) {
    await knex("session").insert(sessions.slice(i, i + 500));
  }

  const llmCalls: Array<Record<string, unknown>> = [];
  const takeoffJobs: Array<Record<string, unknown>> = [];
  let callSeq = 0;
  let jobSeq = 0;

  for (let day = DAYS; day >= 0; day -= 1) {
    const callsToday = 3 + ((DAYS - day) % 7);
    for (let c = 0; c < callsToday; c += 1) {
      const org = pick(orgs, callSeq);
      const createdAt = daysAgo(day);
      llmCalls.push({
        id: `${DEMO_PREFIX}call_${callSeq}`,
        model_version: pick(MODELS, callSeq),
        tokens_in: 400 + ((callSeq * 37) % 2000),
        tokens_out: 100 + ((callSeq * 53) % 900),
        latency_ms: 300 + ((callSeq * 17) % 4000),
        validation_status: callSeq % 11 === 0 ? "failed" : "valid",
        retry_count: callSeq % 11 === 0 ? 1 : 0,
        org_id: org.id,
        created_at: createdAt,
      });
      callSeq += 1;
    }

    const jobsToday = 1 + ((DAYS - day) % 3);
    for (let j = 0; j < jobsToday; j += 1) {
      const createdAt = daysAgo(day);
      const stuck = jobSeq % 40 === 0;
      const failed = !stuck && jobSeq % 8 === 0;
      const started = new Date(createdAt.getTime() + 2000);
      const completed = new Date(createdAt.getTime() + 2000 + (10000 + (jobSeq % 5) * 6000));
      const status = stuck ? "processing" : failed ? "failed" : "completed";
      takeoffJobs.push({
        id: `${DEMO_PREFIX}job_${jobSeq}`,
        status,
        file_name: `demo-plan-${jobSeq}.dwg`,
        storage_path: `demo/${jobSeq}.dwg`,
        project_id: null,
        proposal_id: pick(proposals, jobSeq).id,
        requested_by: `${DEMO_PREFIX}user_${jobSeq % 30}`,
        drawing_count: 1 + (jobSeq % 4),
        element_count: 20 + ((jobSeq * 7) % 300),
        error: failed ? "Demo failure for metrics" : null,
        started_at: started,
        completed_at: stuck ? null : completed,
        created_at: createdAt,
        updated_at: stuck ? started : completed,
      });
      jobSeq += 1;
    }
  }
  for (let i = 0; i < llmCalls.length; i += 500) {
    await knex("llm_calls").insert(llmCalls.slice(i, i + 500));
  }
  for (let i = 0; i < takeoffJobs.length; i += 500) {
    await knex("takeoff_jobs").insert(takeoffJobs.slice(i, i + 500));
  }
}
