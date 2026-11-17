import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import { BadRequestError } from "../../lib/errors.ts";
import { authorizeDailyLogScope } from "./authorization.ts";
import { dailyLogExecutor } from "./daily-log.ts";
import type { DailyLogCommand, FieldActor } from "./types.ts";
import { dailyLogsRepository } from "../daily-logs/repository.ts";
import { dailyLogsService } from "../daily-logs/service.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { buildingsService } from "../buildings/service.ts";
import { dailyReportService } from "../daily-logs/report.ts";
import { filesService } from "../files/service.ts";
import { filesRepository } from "../files/repository.ts";

const url = process.env.FIELD_ACTION_TEST_DATABASE_URL;

async function seed(db: Knex) {
  const prefix = `field_${randomUUID()}`;
  const id = (name: string) => `${prefix}_${name}`;
  await db("user").insert(["owner", "crew", "denied"].map((name) => ({ id: id(name), name, email: `${id(name)}@test.invalid` })));
  await db("organization").insert({ id: id("org"), name: "Field fixture", slug: id("org") });
  await db("projects").insert(["site", "other"].map((name) => ({ id: id(name), name, address: "Fixture", status: "On Track", risk: "Low", currency: "NGN", organization_id: id("org"), owner_id: id("owner") })));
  await db("buildings").insert(["a", "b", "foreign"].map((name) => ({ id: id(name), project_id: id(name === "foreign" ? "other" : "site"), name })));
  await db("project_participants").insert(["crew", "denied"].map((name) => ({
    id: id(`participant_${name}`), project_id: id("site"), user_id: id(name), email: `${id(name)}@test.invalid`, role: "site_agent", status: "active",
    grants: JSON.stringify(name === "crew" ? { project: ["view"], dailyLog: ["create", "view"], buildings: ["view"] } : {}),
  })));
  const actor: FieldActor = { userId: id("crew"), organizationId: id("org") };
  const target = { projectId: id("site"), buildingId: id("a"), logDate: "2026-11-14" };
  return { id, actor, target, async cleanup(connection: Knex = db) {
    await connection("projects").whereIn("id", [id("site"), id("other")]).del();
    await connection("organization").where({ id: id("org") }).del();
    await connection("user").whereIn("id", [id("owner"), id("crew"), id("denied")]).del();
  } };
}

test("daily actions use current grants, full canonical fields and exact building; voids block append/link", { skip: !url }, async () => {
  const connection = knex({ client: "pg", connection: url });
  const db = await connection.transaction();
  try {
    const f = await seed(db); const executor = dailyLogExecutor(db);
    await assert.rejects(authorizeDailyLogScope(db, f.actor, f.target.projectId), /buildingId is required/);
    const entry: DailyLogCommand = { ...f.target, kind: "daily_log", payload: { bodyText: "Eight workers\nSlab poured" } };
    const receipt = await executor.execute(entry, f.actor);
    const saved = await db("daily_log_entries").where({ id: receipt.recordId }).first();
    assert.equal(saved.author_id, f.actor.userId);
    assert.equal(saved.building_id, f.target.buildingId);
    assert.equal(saved.body_html, "<p>Eight workers<br />Slab poured</p>");
    await executor.execute({ ...f.target, kind: "update_daily_log", payload: { workersExpected: 10, workersPresent: 8, precipitationMm: 0, windKph: 15, totalHours: 7.5, summary: "Slab poured", weatherCondition: "Cloudy" } }, f.actor);
    const header = await db("daily_logs").where({ project_id: f.target.projectId, building_id: f.target.buildingId }).first();
    assert.equal(header.workers_present, 8); assert.equal(header.wind_kph, "15.00");
    await assert.rejects(executor.execute(entry, { ...f.actor, userId: f.id("denied") }), /role does not allow/);
    await assert.rejects(executor.execute(entry, { ...f.actor, organizationId: "other-workspace" }), /another workspace/);
    await assert.rejects(executor.execute({ ...entry, buildingId: f.id("foreign") }, f.actor), /real building/);
    await db("project_participants").where({ id: f.id("participant_crew") }).update({ grants: JSON.stringify({}) });
    await assert.rejects(executor.execute(entry, f.actor), /role does not allow/);
    await db("project_participants").where({ id: f.id("participant_crew") }).update({ grants: JSON.stringify({ dailyLog: ["create", "view"] }) });
    await db("platform_settings").insert({ id: "singleton", feature_flags: JSON.stringify({ "quality.dailyLogs": false }) }).onConflict("id").merge();
    await assert.rejects(executor.execute(entry, f.actor), (error: unknown) => error instanceof Error && "code" in error && error.code === "feature_disabled");
    await db("platform_settings").where({ id: "singleton" }).update({ feature_flags: JSON.stringify({ "quality.dailyLogs": true }) });
    await db("uploaded_files").insert({ id: f.id("private_file"), project_id: f.target.projectId, owner_id: f.id("owner"), file_name: "private.png", mime_type: "image/png", size_bytes: 20, storage_path: "fixture/private" });
    await assert.rejects(executor.execute({ ...entry, payload: { bodyHtml: `<p>Evidence</p><img data-file-id="${f.id("private_file")}" src="/files/${f.id("private_file")}/download">` } }, f.actor), /permission to view/);
    const buildings = buildingsRepository(db);
    const logs = dailyLogsService(dailyLogsRepository(db), { assertBuilding: buildingsService(buildings).assertRealBuilding }, buildings.soleRealBuildingId);
    await logs.upsert(f.target.projectId, f.target.logDate, { buildingId: f.id("b"), summary: "Other building" }, f.actor.userId);
    const reports = dailyReportService(db, { logs, files: filesService(filesRepository(db)) });
    const report = await reports.build(f.target.projectId, f.target.logDate, f.id("b"));
    assert.equal(report.day.buildingId, f.id("b")); assert.equal(report.day.summary, "Other building");
    assert.ok(report.pdf.length > 0);
    await logs.voidLog(f.target.projectId, f.target.logDate, "Duplicate day", f.actor.userId, f.target.buildingId);
    assert.equal((await logs.getDay(f.target.projectId, f.target.logDate, f.id("b"))).voidedAt, null);
    await assert.rejects(executor.execute(entry, f.actor), /voided daily log/);
    await assert.rejects(executor.execute({ ...f.target, kind: "update_daily_log", payload: { totalHours: 9 } }, f.actor), /voided daily log/);
    await db("activities").insert({ id: f.id("activity"), project_id: f.target.projectId, building_id: f.target.buildingId, name: "Pour", activity_type: "Concrete", planned_start_at: "2026-11-14", planned_end_at: "2026-11-15" });
    await assert.rejects(logs.linkActivity(f.target.projectId, f.target.logDate, { activityId: f.id("activity"), hoursLogged: 2 }, { id: f.actor.userId, name: "crew" }), /voided daily log/);
    assert.equal(Number((await db("daily_log_entries").where({ project_id: f.target.projectId }).count("*").first())!.count), 1);
  } finally { await db.rollback(); await connection.destroy(); }
});

test("standalone concurrent notes serialize one day; a caller transaction can roll the result back", { skip: !url }, async () => {
  const db = knex({ client: "pg", connection: url, pool: { min: 0, max: 4 } });
  const f = await db.transaction(seed);
  try {
    const command: DailyLogCommand = { ...f.target, kind: "daily_log", payload: { bodyText: "Concrete delivered" } };
    const receipts = await Promise.all(Array.from({ length: 6 }, () => dailyLogExecutor(db).execute(command, f.actor)));
    assert.equal(new Set(receipts.map((r) => r.recordId)).size, 6);
    assert.equal(Number((await db("daily_logs").where({ project_id: f.target.projectId }).count("*").first())!.count), 1);
    const transaction = await db.transaction();
    try {
      const receipt = await dailyLogExecutor(transaction).execute({ ...command, logDate: "2026-11-15" }, f.actor);
      assert.ok(await transaction("daily_log_entries").where({ id: receipt.recordId }).first());
    } finally { await transaction.rollback(); }
    assert.equal(Number((await db("daily_log_entries").where({ project_id: f.target.projectId }).count("*").first())!.count), 6);
    assert.equal(await db("daily_logs").where({ project_id: f.target.projectId, log_date: "2026-11-15" }).first(), undefined);
  } finally { await f.cleanup(db); await db.destroy(); }
});

test("canonical and WhatsApp writers bootstrap one day atomically without dropping each other's fields", { skip: !url }, async () => {
  const db = knex({ client: "pg", connection: url, pool: { min: 0, max: 8 } });
  const f = await db.transaction(seed);
  try {
    const buildings = buildingsRepository(db);
    const logs = dailyLogsService(dailyLogsRepository(db), { assertBuilding: buildingsService(buildings).assertRealBuilding }, buildings.soleRealBuildingId);
    const author = { id: f.actor.userId, name: "crew", role: "site_agent" };
    await db("activities").insert({ id: f.id("activity"), project_id: f.target.projectId, building_id: f.target.buildingId, name: "Pour", activity_type: "Concrete", planned_start_at: f.target.logDate, planned_end_at: "2026-11-15" });
    const outcomes = await Promise.allSettled([
      ...Array.from({ length: 4 }, () => logs.addEntry(f.target.projectId, f.target.logDate, { buildingId: f.target.buildingId, bodyHtml: "<p>Canonical note</p>", bodyText: "Canonical note" }, author)),
      dailyLogExecutor(db).execute({ ...f.target, kind: "daily_log", payload: { bodyText: "WhatsApp note" } }, f.actor),
      logs.upsert(f.target.projectId, f.target.logDate, { buildingId: f.target.buildingId, workersExpected: 10, summary: "Canonical header" }, f.id("owner")),
      dailyLogExecutor(db).execute({ ...f.target, kind: "update_daily_log", payload: { workersPresent: 5, windKph: 3 } }, f.actor),
      logs.linkActivity(f.target.projectId, f.target.logDate, { activityId: f.id("activity"), hoursLogged: 2 }, author),
    ]);
    for (const result of outcomes) assert.equal(result.status, "fulfilled", result.status === "rejected" ? String(result.reason) : undefined);
    assert.equal(Number((await db("daily_logs").where({ project_id: f.target.projectId }).count("*").first())!.count), 1);
    assert.equal(Number((await db("daily_log_entries").where({ project_id: f.target.projectId }).count("*").first())!.count), 5);
    const header = await db("daily_logs").where({ project_id: f.target.projectId }).first();
    assert.equal(header.workers_expected, 10); assert.equal(header.workers_present, 5);
    assert.equal(header.summary, "Canonical header"); assert.equal(header.wind_kph, "3.00");
  } finally { await f.cleanup(db); await db.destroy(); }
});

test("a competing canonical void blocks stale note, header and activity-link writes", { skip: !url }, async () => {
  const db = knex({ client: "pg", connection: url });
  const f = await db.transaction(seed);
  try {
    const buildings = buildingsRepository(db); const repository = dailyLogsRepository(db);
    const hooks = { assertBuilding: buildingsService(buildings).assertRealBuilding };
    const ordinary = dailyLogsService(repository, hooks, buildings.soleRealBuildingId);
    const author = { id: f.actor.userId, name: "crew", role: "site_agent" };
    await db("activities").insert({ id: f.id("activity"), project_id: f.target.projectId, building_id: f.target.buildingId, name: "Pour", activity_type: "Concrete", planned_start_at: f.target.logDate, planned_end_at: "2026-11-15" });
    for (const [index, kind] of ["note", "header", "activity"].entries()) {
      const logDate = `2026-11-${16 + index}`; const key = { ...f.target, logDate };
      await repository.upsert(key, { workersPresent: 8, summary: "Original header" }, f.actor.userId);
      let release!: () => void; let observed!: () => void; let paused = false;
      const proceed = new Promise<void>((resolve) => { release = resolve; });
      const read = new Promise<void>((resolve) => { observed = resolve; });
      const logs = dailyLogsService({ ...repository, async findOne(target) {
        const row = await repository.findOne(target);
        if (!paused) { paused = true; observed(); await proceed; }
        return row;
      } }, hooks, buildings.soleRealBuildingId);
      const writing = (kind === "note"
        ? logs.addEntry(key.projectId, logDate, { buildingId: key.buildingId, bodyHtml: "<p>Too late</p>", bodyText: "Too late" }, author)
        : kind === "header" ? logs.upsert(key.projectId, logDate, { buildingId: key.buildingId, workersPresent: 99 }, f.actor.userId)
        : logs.linkActivity(key.projectId, logDate, { activityId: f.id("activity"), hoursLogged: 9 }, author)
      ).then(() => null, (error: unknown) => error);
      await read;
      try { await ordinary.voidLog(key.projectId, logDate, "Closed before the delayed write", f.actor.userId, key.buildingId); }
      finally { release(); }
      const error = await writing;
      assert.ok(error instanceof BadRequestError, `${kind} must recheck the parent day after its stale service read`);
      assert.match(error.message, /voided daily log/);
      assert.equal((await repository.findOne(key))!.workers_present, 8);
    }
    assert.equal(Number((await db("daily_log_entries").where({ project_id: f.target.projectId }).count("*").first())!.count), 0);
    assert.equal(Number((await db("daily_log_activities").where({ project_id: f.target.projectId }).count("*").first())!.count), 0);
  } finally { await f.cleanup(db); await db.destroy(); }
});

test("pending voids lock out note/header/link writes, and only the first void reason survives", { skip: !url }, async () => {
  const db = knex({ client: "pg", connection: url });
  const f = await db.transaction(seed);
  try {
    const repository = dailyLogsRepository(db);
    await db("activities").insert({ id: f.id("activity"), project_id: f.target.projectId, building_id: f.target.buildingId, name: "Pour", activity_type: "Concrete", planned_start_at: f.target.logDate, planned_end_at: "2026-11-15" });
    for (const [index, kind] of ["note", "header", "activity"].entries()) {
      const key = { ...f.target, logDate: `2026-11-${20 + index}` };
      await repository.upsert(key, { workersPresent: 8 }, f.actor.userId);
      const voider = await db.transaction(); const writer = await db.transaction();
      try {
        await dailyLogsRepository(voider).voidOne(key, "First decision", f.actor.userId);
        const { rows: [connection] } = await writer.raw("select pg_backend_pid() as pid");
        const writes = dailyLogsRepository(writer); let finished = false;
        const pending = (kind === "note"
          ? writes.insertEntry({ ...key, authorId: f.actor.userId, authorName: "crew", authorRole: "site_agent", bodyHtml: "<p>Too late</p>", bodyText: "Too late", form: null })
          : kind === "header" ? writes.upsert(key, { workersPresent: 99 }, f.actor.userId)
          : writes.upsertActivityLink(key, f.id("activity"), 9)
        ).then(() => { finished = true; return null; }, (error: unknown) => { finished = true; return error; });
        let blocked = false; const expires = Date.now() + 2_000;
        while (!finished && Date.now() < expires) {
          const state = await db("pg_stat_activity").where({ pid: connection.pid }).select("wait_event_type").first();
          if (state?.wait_event_type === "Lock") { blocked = true; break; }
          await delay(5);
        }
        assert.ok(blocked, `${kind} must wait for the transaction deciding whether the parent day is void`);
        await voider.commit();
        const error = await pending;
        assert.ok(error instanceof BadRequestError); assert.match(error.message, /voided daily log/);
      } finally { await voider.rollback(); await writer.rollback(); }
    }
    const key = { ...f.target, logDate: "2026-11-23" };
    await repository.upsert(key, {}, f.actor.userId);
    const decisions = await Promise.allSettled([repository.voidOne(key, "Decision A", f.actor.userId), repository.voidOne(key, "Decision B", f.actor.userId)]);
    assert.equal(decisions.filter((result) => result.status === "fulfilled").length, 1);
    const winner = decisions.find((result) => result.status === "fulfilled");
    assert.ok(winner?.status === "fulfilled");
    assert.equal((await repository.findOne(key))!.void_reason, winner.value.void_reason);
    const loser = decisions.find((result) => result.status === "rejected");
    assert.ok(loser?.status === "rejected" && loser.reason instanceof BadRequestError);
    assert.equal(Number((await db("daily_log_entries").where({ project_id: f.target.projectId }).count("*").first())!.count), 0);
    assert.equal(Number((await db("daily_log_activities").where({ project_id: f.target.projectId }).count("*").first())!.count), 0);
  } finally { await f.cleanup(db); await db.destroy(); }
});
