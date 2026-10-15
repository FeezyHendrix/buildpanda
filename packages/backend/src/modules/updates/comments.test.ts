import assert from "node:assert/strict";
import { test } from "node:test";
import { recordFixture, recordTestUrl } from "../tasks/record-visibility-fixture.ts";
import { registerUpdateComments } from "./comment-routes.ts";
import { updatesService } from "./service.ts";
import { updatesRepository } from "./repository.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { requireProjectFileReferences } from "../files/attachment-access.ts";
import { PARTICIPANT_PERMISSIONS } from "../../lib/role-presets.ts";
import { up as migratePresets } from "../../db/migrations/20261015_record_visibility_presets.ts";
import { buildTools } from "../panda-ai/agent/tools.ts";
import { toolsForCaller } from "../panda-ai/agent/tool-permissions.ts";

const grants = { project: ["view"], updates: ["view"], comments: ["post"] };
test("published update discussion authorizes rich content, audio, retries and direct requests", { skip: !recordTestUrl }, async () => {
  const f = await recordFixture();
  const files = filesRepository(f.db); const fileAccess = fileAccessRepository(f.db);
  const service = updatesService(updatesRepository(f.db), filesService(files));
  f.app.addHook("preHandler", async (request) => {
    if (request.method === "POST") await requireProjectFileReferences(request, (request.params as { id?: string }).id, files, fileAccess);
  });
  await registerUpdateComments(f.app, service);
  const path = "/projects/scope-site/updates/comment-post/comments";
  const post = (payload: object, url = path) => f.app.inject({ method: "POST", url, payload });
  try {
    await f.db("project_updates").insert(["post", "draft", "foreign"].map((id) => ({ id: `comment-${id}`, project_id: id === "foreign" ? "scope-foreign" : "scope-site", author_id: "scope-crew", author_name: "Crew", author_role: "", category: "Progress", title: id, description: "Site progress", cta_label: "Approve", cta_tone: "primary", is_draft: id === "draft" })));
    await f.db("uploaded_files").insert(["audio", "image", "secret", "foreign"].map((id) => ({ id: `comment-${id}-file`, project_id: id === "foreign" ? "scope-foreign" : "scope-site", owner_id: "scope-crew", file_name: id === "image" ? "photo.png" : "voice.m4a", mime_type: id === "image" ? "image/png" : "audio/m4a", size_bytes: 400, storage_path: `fixture/${id}` })));
    await f.db("project_transactions").where({ id: "scope-expense-hidden" }).update({ description: "[Voice](/files/comment-secret-file/download)" });
    f.asParticipant(grants);
    const payload = { bodyHtml: '<p>Beam <b>ready</b>.</p><img src="/files/comment-image-file/download" data-file-id="comment-image-file" alt="Beam">', audioFileId: "comment-audio-file", audioDurationSeconds: 8, clientMutationId: "local_comment" };
    const first = await post(payload); assert.equal(first.statusCode, 201, first.body);
    const saved = first.json(); assert.equal(saved.author.id, "scope-crew"); assert.match(saved.body, /Beam ready/); assert.equal(saved.audioFileId, payload.audioFileId); assert.match(saved.bodyHtml, /comment-image-file/);
    const retry = await post(payload); assert.equal(retry.statusCode, 201, retry.body); assert.equal(retry.json().id, saved.id);
    assert.equal((await f.app.inject(path)).json().length, 1);
    assert.equal((await post({ body: "Legacy text comment" })).statusCode, 201);
    assert.equal((await post({ audioFileId: "comment-audio-file", audioDurationSeconds: 8 })).statusCode, 201);
    assert.equal((await post({})).statusCode, 400);
    assert.equal((await post({ audioFileId: "comment-image-file", audioDurationSeconds: 8 })).statusCode, 400);
    assert.equal((await post({ audioFileId: "comment-audio-file", audioDurationSeconds: 301 })).statusCode, 400);
    assert.equal((await post({ audioFileId: "comment-foreign-file", audioDurationSeconds: 8 })).statusCode, 403);
    assert.equal((await post({ audioFileId: "comment-secret-file", audioDurationSeconds: 8 })).statusCode, 403);
    for (const id of ["draft", "foreign"]) {
      const url = `/projects/scope-site/updates/comment-${id}/comments`;
      assert.equal((await f.app.inject(url)).statusCode, 404);
      assert.equal((await post({ body: "Forbidden" }, url)).statusCode, 404);
    }
    const ctx = f.toolContext(); const ai = toolsForCaller(buildTools(), ctx).find((t) => t.spec.function.name === "get_update_comments"); assert(ai);
    const output = await ai.run(ctx, { updateId: "comment-post" }); assert.match(JSON.stringify(output), /hasAudio/);
    await assert.rejects(ai.run(ctx, { updateId: "comment-foreign" }));
    await f.readFile("comment-audio-file");
    f.asParticipant({ project: ["view"], updates: ["view"] });
    assert.equal((await f.app.inject(path)).statusCode, 200);
    assert.equal((await post({ body: "Read-only" })).statusCode, 403);
    assert.equal((await post({}, `${path}/transcribe`)).statusCode, 403, "transcription is denied before reading audio");
    f.asParticipant({}); assert.equal((await f.app.inject(path)).statusCode, 403);
    await assert.rejects(f.readFile("comment-audio-file")); await assert.rejects(ai.run(f.toolContext(), { updateId: "comment-post" }));
  } finally { await f.close(); }
});

test("visibility migration updates only untouched manager presets", { skip: !recordTestUrl }, async () => {
  const f = await recordFixture();
  try {
    const preset = PARTICIPANT_PERMISSIONS.project_manager!;
    const old = { ...preset, tasks: preset.tasks!.filter((a) => a !== "viewAll"), finances: preset.finances!.filter((a) => a !== "viewAllExpenses") };
    const maps = [old, {}, { ...old, tasks: ["view"] }];
    await f.db("project_participants").insert(maps.map((map, i) => ({ id: `preset-${i}`, project_id: "scope-site", email: `preset${i}@scope.invalid`, role: "project_manager", grants: JSON.stringify(map) })));
    await migratePresets(f.db);
    const rows = await f.db("project_participants").whereIn("id", ["preset-0", "preset-1", "preset-2"]).orderBy("id");
    assert(rows[0].grants.tasks.includes("viewAll")); assert(rows[0].grants.finances.includes("viewAllExpenses"));
    assert.deepEqual(rows[1].grants, {}); assert.deepEqual(rows[2].grants, maps[2]);
  } finally { await f.close(); }
});
