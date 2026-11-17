import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import { collaborationHandlers } from "./collaboration.ts";
import { fieldToolContext } from "./tool-context.ts";
import type { FieldToolInput } from "./tool-types.ts";
import type { QueueManager } from "../../lib/queue/index.ts";
import { accessContextRepository } from "../access-context/repository.ts";
import { documentNotificationAccess } from "../documents/notification-access.ts";
import { messagingAgentAccess } from "../messaging-agent/access.ts";
import { messagingToolDiscovery } from "../messaging-agent/tool-discovery.ts";
import { requireMessagingReviewTargets } from "../messaging-agent/review-access.ts";

const url = process.env.FIELD_ACTION_TEST_DATABASE_URL ?? process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const grants = { project: ["view"], messages: ["view", "send"], updates: ["view", "post"], comments: ["post"], documents: ["view", "upload", "delete", "markup"] };

async function fixture(run: (db: Knex.Transaction, id: (name: string) => string) => Promise<void>) {
  const connection = knex({ client: "pg", connection: url });
  const db = await connection.transaction(), prefix = `collaboration_${randomUUID().slice(0, 8)}`;
  const id = (name: string) => `${prefix}_${name}`;
  try {
    await db("user").insert(["owner", "crew", "denied", "recipient", "outsider"].map((name) => ({ id: id(name), name, email: `${id(name)}@test.invalid` })));
    await db("organization").insert({ id: id("org"), name: "Collaboration tests", slug: id("org") });
    await db("member").insert(["owner", "recipient"].map((name) => ({ id: id(`${name}-member`), organizationId: id("org"), userId: id(name), role: name === "owner" ? "owner" : "member" })));
    await db("projects").insert(["site", "foreign"].map((name) => ({ id: id(name), name, address: "Fixture", status: "On Track", risk: "Low", currency: "NGN", organization_id: id("org"), owner_id: id("owner") })));
    await db("project_participants").insert(["crew", "denied"].map((name) => ({ id: id(`${name}-participant`), project_id: id("site"), user_id: id(name), email: `${id(name)}@test.invalid`, role: "site_agent", status: "active", grants: JSON.stringify(name === "crew" ? grants : { project: ["view"] }) })));
    await db("channels").insert(["site", "foreign", "private", "sibling"].map((name) => ({ id: id(`${name}-channel`), type: "project", name, project_id: id(name === "foreign" ? "foreign" : "site"), created_by_id: id("owner") })));
    await db("channel_members").insert(["owner", "crew"].flatMap((name) => ["site", "foreign", "sibling"].map((channel) => ({ id: id(`${name}-${channel}`), channel_id: id(`${channel}-channel`), user_id: id(name), role: "member" }))));
    await db("document_categories").insert({ id: id("category"), name: id("Drawings"), tone: "brand", group: "plan" });
    await db("uploaded_files").insert([
      { id: id("file-a"), project_id: id("site"), owner_id: id("crew"), file_name: "A.pdf", mime_type: "application/pdf", size_bytes: 1024, storage_path: "fixture/a" },
      { id: id("file-b"), project_id: id("site"), owner_id: id("crew"), file_name: "B.pdf", mime_type: "application/pdf", size_bytes: 2048, storage_path: "fixture/b" },
      { id: id("image"), project_id: id("site"), owner_id: id("crew"), file_name: "Inspection.png", mime_type: "image/png", size_bytes: 100, storage_path: "fixture/image" },
      { id: id("foreign-file"), project_id: id("foreign"), owner_id: id("crew"), file_name: "Foreign.pdf", mime_type: "application/pdf", size_bytes: 100, storage_path: "fixture/foreign" },
    ]);
    await run(db, id);
  } finally { await db.rollback(); await connection.destroy(); }
}

async function execute(db: Knex, id: (name: string) => string, kind: keyof typeof collaborationHandlers, payload: Record<string, unknown>, user = "crew") {
  const input: FieldToolInput = { kind, projectId: id("site"), buildingId: null, payload, idempotencyKey: randomUUID() };
  const context = await fieldToolContext(db, input, { userId: id(user), organizationId: id("org") });
  return collaborationHandlers[kind](input, context);
}

test("collaboration messages preserve membership, workspace grants, parent channels and archived state", { skip: !url }, async () => fixture(async (db, id) => {
  const body = "Please check the pour.\n\nThe crew is ready.";
  const sent = await execute(db, id, "send_message", { channelId: id("site-channel"), body, contentHtml: "<p>Please check the pour.</p><p>The crew is ready.</p>" });
  const row = await db("messages").where({ id: sent.recordId }).first();
  assert.equal(row.body, body); assert.equal(row.author_id, id("crew"));
  const reply = await execute(db, id, "reply_message", { messageId: row.id, body: "Inspected." });
  assert.equal((await db("messages").where({ id: reply.recordId }).first()).parent_message_id, row.id);
  await assert.rejects(execute(db, id, "send_message", { channelId: id("private-channel"), body }), /Channel not found/);
  await assert.rejects(execute(db, id, "send_message", { channelId: id("foreign-channel"), body }, "owner"), /another selected project|this project or workspace/);
  await assert.rejects(execute(db, id, "send_message", { channelId: id("sibling-channel"), body, parentMessageId: row.id }, "owner"), /unavailable in this conversation/);
  await assert.rejects(execute(db, id, "send_direct_message", { userId: id("recipient"), body }), /workspace permissions/);
  await assert.rejects(execute(db, id, "send_direct_message", { userId: id("outsider"), body }, "owner"), /members of this workspace/);
  const direct = await execute(db, id, "send_direct_message", { userId: id("recipient"), body }, "owner");
  assert.equal((await db("messages").where({ id: direct.recordId }).first()).body, body);
  await db("channels").where({ id: id("site-channel") }).update({ archived_at: new Date() });
  await assert.rejects(execute(db, id, "reply_message", { messageId: row.id, body }), /archived/);
  await db("channels").where({ id: id("site-channel") }).update({ archived_at: null });
  await db("project_participants").where({ id: id("crew-participant") }).update({ grants: JSON.stringify({ ...grants, messages: ["view"] }) });
  await assert.rejects(execute(db, id, "send_message", { channelId: id("site-channel"), body }), /role does not allow/);
}));

test("explicit confirmed General sends bootstrap once without discovery writes, denied writes or rollback residue", { skip: !url }, async () => fixture(async (db, id) => {
  await db("channels").where({ project_id: id("site") }).delete();
  const scope = { projectId: id("site"), organizationId: id("org"), buildingId: null };
  const access = await messagingAgentAccess(db).project(id("crew"), id("site"));
  const discovery = await messagingToolDiscovery(db, access, scope);
  assert.deepEqual((discovery.targets.projectGeneral as { target: unknown }).target, { projectGeneral: true });
  const action = { kind: "send_message", payload: { projectGeneral: true, body: "First General message.\n\nThe crew is ready." } };
  await requireMessagingReviewTargets(db, access, scope, [action]);
  const channelCount = async () => Number((await db("channels").where({ project_id: id("site") }).count("*").first())!.count);
  assert.equal(await channelCount(), 0, "discovery and review must not create a channel");
  await assert.rejects(execute(db, id, "send_message", action.payload, "denied"), /role does not allow/);
  assert.equal(await channelCount(), 0);
  await assert.rejects(db.transaction(async (child) => {
    await execute(child, id, "send_message", action.payload);
    throw new Error("Roll back first General send");
  }), /Roll back first General send/);
  assert.equal(await channelCount(), 0);
  const first = await execute(db, id, "send_message", action.payload);
  const second = await execute(db, id, "send_message", { projectGeneral: true, body: "Second General message." });
  assert.equal(await channelCount(), 1);
  assert.equal(first.data!.channelId, second.data!.channelId);
  const channelId = first.data!.channelId as string;
  const channel = await db("channels").where({ id: channelId }).first();
  assert.equal(channel.project_id, id("site")); assert.equal(channel.name, "general");
  assert.equal((await db("messages").where({ id: first.recordId }).first()).body, action.payload.body);
  assert.equal(Number((await db("messages").where({ channel_id: channelId }).count("*").first())!.count), 2);
  assert.deepEqual((await db("channel_members").where({ channel_id: channelId }).pluck("user_id")).sort(), [id("owner"), id("crew"), id("denied")].sort());
  await db("channels").where({ id: channelId }).update({ is_private: true });
  await db("channel_members").where({ channel_id: channelId, user_id: id("crew") }).delete();
  await assert.rejects(execute(db, id, "send_message", action.payload), /Channel not found/);
  assert.equal(await db("channel_members").where({ channel_id: channelId, user_id: id("crew") }).first(), undefined);
  await db("project_participants").where({ id: id("crew-participant") }).update({ grants: JSON.stringify({ ...grants, messages: ["view"] }) });
  const revoked = await messagingAgentAccess(db).project(id("crew"), id("site"));
  await assert.rejects(requireMessagingReviewTargets(db, revoked, scope, [action]), /role does not allow/);
  await assert.rejects(execute(db, id, "send_message", action.payload), /role does not allow/);
  assert.equal(Number((await db("messages").where({ channel_id: channelId }).count("*").first())!.count), 2);
}));

test("updates use canonical stage, published-comment, category, media and current permission rules", { skip: !url }, async () => fixture(async (db, id) => {
  const created = await execute(db, id, "create_project_update", { category: "Progress", title: "Pour complete", description: "Level two.\n\nNo incidents.", descriptionHtml: "<p>Level two.</p><p>No incidents.</p>", media: [{ type: "photo", url: `/files/${id("image")}/download` }] });
  const row = await db("project_updates").where({ id: created.recordId }).first();
  assert.equal(row.project_id, id("site")); assert.equal(row.author_id, id("crew")); assert.equal(row.description, "Level two.\n\nNo incidents.");
  const edited = await execute(db, id, "edit_project_update", { updateId: row.id, title: "Pour inspected" });
  assert.equal(edited.recordId, row.id);
  const comment = await execute(db, id, "comment_project_update", { updateId: row.id, body: "Looks good.", bodyHtml: "<p>Looks good.</p>" });
  assert.equal((await db("update_comments").where({ id: comment.recordId }).first()).body, "Looks good.");
  await db("project_updates").where({ id: row.id }).update({ is_draft: true });
  await assert.rejects(execute(db, id, "comment_project_update", { updateId: row.id, body: "Hidden draft" }), /Published update not found/);
  await assert.rejects(execute(db, id, "create_project_update", { category: "Progress", title: "Foreign stage", description: "Text", stageId: id("unknown-stage") }), /stage must belong/);
  await assert.rejects(execute(db, id, "create_project_update", { category: "Guessed", title: "Wrong category", description: "Text" }), /allowed values/);
  await assert.rejects(execute(db, id, "create_project_update", { category: "Progress", title: "External media", description: "Text", media: [{ type: "photo", url: "https://example.test/site.jpg" }] }), /project-uploaded/);
  await assert.rejects(execute(db, id, "create_project_update", { category: "Progress", title: "Wrong MIME", description: "Text", media: [{ type: "photo", url: `/files/${id("file-a")}/download` }] }), /matching project photo/);
  await assert.rejects(execute(db, id, "delete_project_update", { updateId: row.id }, "denied"), /role does not allow/);
  await execute(db, id, "delete_project_update", { updateId: row.id });
  assert.equal(await db("project_updates").where({ id: row.id }).first(), undefined);
}));

test("document uploads use owned project files; reads and revisions retain exact authorized versions", { skip: !url }, async () => fixture(async (db, id) => {
  const created = await execute(db, id, "upload_document", { fileId: id("file-a"), categoryId: id("category"), revision: "Rev A", title: "Foundation plan" });
  const first = await db("project_documents").where({ id: created.recordId }).first();
  assert.equal(first.file_id, id("file-a")); assert.equal(first.project_id, id("site"));
  const firstVersion = first.current_version_id;
  await execute(db, id, "rename_document", { documentId: first.id, fileName: "Issued foundation.pdf" });
  assert.equal((await db("project_documents").where({ id: first.id }).first()).file_name, "Issued foundation.pdf");
  const second = await execute(db, id, "upload_document_version", { documentId: first.id, fileId: id("file-b"), revisionLabel: "Rev B", notes: "Opening revised.\n\nIssued for site." });
  assert.equal(second.data?.versionNo, 2);
  const opened = await execute(db, id, "open_document", { documentId: first.id });
  assert.equal(opened.data?.versionId, second.recordId); assert.equal(opened.data?.requiresAuthentication, true);
  assert.equal(opened.data?.storagePath, undefined); assert.match(String(opened.data?.url), new RegExp(`${second.recordId}/view$`));
  const downloaded = await execute(db, id, "download_document", { documentId: first.id, versionId: firstVersion });
  assert.equal(downloaded.data?.versionId, firstVersion); assert.equal(downloaded.data?.versionNo, 1);
  assert.doesNotMatch(downloaded.message!, /delivered|downloaded/i);
  await assert.rejects(execute(db, id, "upload_document", { fileId: id("foreign-file") }), /another project|belong to this project/);
  await assert.rejects(execute(db, id, "upload_document", { fileId: id("file-a") }, "owner"), /permission|Forbidden/);
  await assert.rejects(execute(db, id, "open_document", { documentId: first.id, versionId: id("foreign-version") }), /Document revision/);
  await assert.rejects(execute(db, id, "open_document", { documentId: first.id }, "denied"), /role does not allow/);
  await db("project_documents").where({ id: first.id }).update({ project_id: id("foreign") });
  await assert.rejects(execute(db, id, "rename_document", { documentId: first.id, fileName: "Other.pdf" }), /Document not found/);
  await db("project_documents").where({ id: first.id }).update({ project_id: id("site") });
  await execute(db, id, "delete_document", { documentId: first.id });
  assert.equal(await db("project_documents").where({ id: first.id }).first(), undefined);
}));

test("drawing actions keep document, version, page, geometry and original-thread scope", { skip: !url }, async () => fixture(async (db, id) => {
  const document = await execute(db, id, "upload_document", { fileId: id("file-a"), categoryId: id("category") });
  const revision = await execute(db, id, "upload_document_version", { documentId: document.recordId, fileId: id("file-b"), revisionLabel: "Rev B" });
  const base = { documentId: document.recordId, documentVersionId: document.data!.versionId, pageNo: 2, kind: "pin", geometry: { kind: "pin", space: "percent", at: { x: 25, y: 40 } }, comment: { body: "Check opening.\n\nConfirm width.", bodyHtml: "<p>Check opening.</p><p>Confirm width.</p>" } };
  const pin = await execute(db, id, "annotate_drawing", base);
  const row = await db("drawing_markups").where({ id: pin.recordId }).first();
  assert.equal(row.document_version_id, document.data!.versionId); assert.equal(row.page_no, 2); assert.notEqual(row.document_version_id, revision.recordId);
  assert.deepEqual(row.geometry, base.geometry);
  await execute(db, id, "comment_drawing", { markupId: pin.recordId, body: "Measured 1200 mm." });
  assert.equal(Number((await db("drawing_markup_comments").where({ markup_id: pin.recordId }).count("*").first())!.count), 2);
  await execute(db, id, "resolve_drawing", { markupId: pin.recordId, resolved: true });
  assert.ok((await db("drawing_markups").where({ id: pin.recordId }).first()).resolved_at);
  await execute(db, id, "resolve_drawing", { markupId: pin.recordId, resolved: false });
  assert.equal((await db("drawing_markups").where({ id: pin.recordId }).first()).resolved_at, null);
  await assert.rejects(execute(db, id, "annotate_drawing", { ...base, documentVersionId: id("unknown-version") }), /Document version/);
  await assert.rejects(execute(db, id, "annotate_drawing", { ...base, geometry: { kind: "pin", at: { x: 101, y: 40 } } }), /between 0 and 100/);
  await assert.rejects(execute(db, id, "annotate_drawing", { ...base, kind: "pen" }), /does not match/);
  await assert.rejects(execute(db, id, "comment_drawing", { markupId: pin.recordId, body: "Denied" }, "denied"), /role does not allow/);
  await db("drawing_markups").where({ id: pin.recordId }).update({ project_id: id("foreign") });
  await assert.rejects(execute(db, id, "resolve_drawing", { markupId: pin.recordId, resolved: true }), /Markup not found/);
  await db("drawing_markups").where({ id: pin.recordId }).update({ project_id: id("site") });
  await execute(db, id, "delete_drawing", { markupId: pin.recordId });
  assert.equal(await db("drawing_markups").where({ id: pin.recordId }).first(), undefined);
}));

test("canonical collaboration notifications finish in the transaction and external jobs wait for the parent commit", { skip: !url }, async () => {
  const jobs: string[] = [];
  const queue = { async enqueue(name: string) { jobs.push(name); } } as unknown as QueueManager;
  await fixture(async (db, id) => {
    await db("organizationRole").insert({ id: id("document-role"), organizationId: id("org"), role: "document-reviewer", permission: JSON.stringify({ project: ["view"], documents: ["view"] }) });
    await db("member").where({ id: id("recipient-member") }).update({ role: "document-reviewer" });
    const users = [id("owner"), id("crew"), id("denied"), id("recipient")];
    const access = accessContextRepository(db), batched = await access.loadMany(users);
    for (const userId of users) assert.deepEqual(batched.get(userId), await access.load(userId));
    assert.deepEqual(await documentNotificationAccess(db)([id("owner"), id("crew"), id("denied")], id("site")), [id("owner"), id("crew")]);
    assert.deepEqual(await documentNotificationAccess(db)([id("recipient")], id("site")), [id("recipient")]);
    await db("organizationRole").where({ id: id("document-role") }).update({ permission: JSON.stringify({ project: ["view"] }) });
    assert.deepEqual(await documentNotificationAccess(db)([id("recipient")], id("site")), []);
    await db.transaction(async (child) => {
      const input: FieldToolInput = { kind: "upload_document", projectId: id("site"), buildingId: null, payload: { fileId: id("file-a") }, idempotencyKey: randomUUID() };
      const context = await fieldToolContext(child, input, { userId: id("crew"), organizationId: id("org") }, queue);
      await collaborationHandlers.upload_document(input, context);
      assert.equal(Number((await child("notifications").where({ project_id: id("site"), type: "document_uploaded" }).count("*").first())!.count), 1);
      assert.deepEqual(jobs, []);
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(jobs, []);
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(jobs, [], "a committed child must not send an email after its parent rolls back");
});

test("drawing follow-up RFIs and material approvals link the actual new pin and roll back with their caller", { skip: !url }, async () => fixture(async (db, id) => {
  const document = await execute(db, id, "upload_document", { fileId: id("file-a"), categoryId: id("category") });
  const base = { documentId: document.recordId, documentVersionId: document.data!.versionId, pageNo: 1, kind: "pin", geometry: { kind: "pin", space: "percent", at: { x: 25, y: 40 } } };
  const followUps = [
    { kind: "rfi", payload: { subject: "Opening width", question: "Please confirm the width.", questionHtml: "<p>Please confirm the width.</p>" } },
    { kind: "create_material_approval", payload: { title: "Check sample", materialName: "Granite", requestedReviewerId: id("owner") } },
  ];
  await assert.rejects(execute(db, id, "annotate_drawing", { ...base, followUp: followUps[0] }), /role does not allow/);
  assert.equal(Number((await db("drawing_markups").where({ project_id: id("site") }).count("*").first())!.count), 0);
  await db("project_participants").where({ id: id("crew-participant") }).update({ grants: JSON.stringify({ ...grants, rfis: ["view", "create"], materials: ["request"] }) });
  for (const followUp of followUps) {
    const saved = await execute(db, id, "annotate_drawing", { ...base, followUp });
    const table = followUp.kind === "rfi" ? "rfis" : "approvals";
    const linked = await db(table).where({ id: saved.data!.relatedRecordId }).first();
    assert.equal(linked.source_markup_id, saved.recordId);
    assert.equal(linked.document_id, document.recordId);
    assert.equal(linked.document_version_id, document.data!.versionId);
    assert.equal(saved.data!.relatedKind, followUp.kind);
    await assert.rejects(db.transaction(async (child) => {
      await execute(child, id, "annotate_drawing", { ...base, followUp });
      throw new Error("Roll back the composite action receipt");
    }), /composite action receipt/);
    assert.equal(Number((await db(table).where({ project_id: id("site") }).count("*").first())!.count), 1);
  }
  assert.equal(Number((await db("drawing_markups").where({ project_id: id("site") }).count("*").first())!.count), 2);
  await assert.rejects(execute(db, id, "annotate_drawing", { ...base, followUp: { ...followUps[0], payload: { ...followUps[0]!.payload, documentId: id("foreign-document") } } }), /selected drawing revision/);
  await assert.rejects(execute(db, id, "annotate_drawing", { ...base, followUp: { ...followUps[0], payload: { ...followUps[0]!.payload, sourceMarkupId: id("guessed-pin") } } }), /Check the action details/);
}));
