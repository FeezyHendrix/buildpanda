import assert from "node:assert/strict";
import { test } from "node:test";
import { collaborationHandlers, collaborationSchemas } from "./collaboration.ts";
import { validateFieldPayload } from "./tool-schema.ts";

const payloads = {
  send_message: { channelId: "channel", body: "Please check the pour.\n\nThe crew is ready." },
  send_direct_message: { userId: "member", body: "Please check the pour." },
  reply_message: { messageId: "message", body: "Checked." },
  create_project_update: { title: "Pour complete", category: "Progress", description: "Level two complete." },
  edit_project_update: { updateId: "update", description: "Level three complete." },
  delete_project_update: { updateId: "update" },
  comment_project_update: { updateId: "update", body: "Inspected." },
  upload_document: { fileId: "file" },
  rename_document: { documentId: "document", fileName: "Issued drawing.pdf" },
  upload_document_version: { documentId: "document", fileId: "file", revisionLabel: "Rev B" },
  download_document: { documentId: "document", versionId: "version-a" },
  open_document: { documentId: "document" },
  delete_document: { documentId: "document" },
  annotate_drawing: { documentId: "document", documentVersionId: "version-a", pageNo: 2, kind: "pin", geometry: { kind: "pin", space: "percent", at: { x: 25, y: 40 } }, comment: { body: "Check this opening." } },
  comment_drawing: { markupId: "markup", body: "Checked the opening." },
  resolve_drawing: { markupId: "markup", resolved: false },
  delete_drawing: { markupId: "markup" },
} as const;

test("all seventeen collaboration actions use strict canonical schemas without dropping unknown intent", () => {
  assert.equal(Object.keys(payloads).length, 17);
  assert.deepEqual(Object.keys(collaborationHandlers).sort(), Object.keys(payloads).sort());
  for (const kind of Object.keys(payloads) as (keyof typeof payloads)[]) {
    const payload = structuredClone(payloads[kind]);
    assert.deepEqual(validateFieldPayload(collaborationSchemas[kind], payload), payload);
    assert.throws(() => validateFieldPayload(collaborationSchemas[kind], { ...payload, inventedPath: "/private/file" }), /Check the action details/);
  }
  assert.throws(() => validateFieldPayload(collaborationSchemas.resolve_drawing, { markupId: "markup", resolved: "false" }), /boolean/);
  assert.throws(() => validateFieldPayload(collaborationSchemas.upload_document, { fileName: "invented.pdf", size: "2 MB" }), /fileId/);
  assert.throws(() => validateFieldPayload(collaborationSchemas.rename_document, { documentId: "document" }), /properties/);
  assert.doesNotThrow(() => validateFieldPayload(collaborationSchemas.send_message, { projectGeneral: true, body: "Post to this project's General channel." }));
  for (const target of [{}, { channelId: "channel", projectGeneral: true }, { projectGeneral: false }, { projectGeneral: "true" }]) {
    assert.throws(() => validateFieldPayload(collaborationSchemas.send_message, { ...target, body: "Check the pour." }), /Check the action details/);
  }
  assert.doesNotThrow(() => validateFieldPayload(collaborationSchemas.send_message, { projectGeneral: true, body: "Hello General." }));
  for (const target of [{}, { projectGeneral: false }, { projectGeneral: "true" }, { projectGeneral: true, channelId: "channel" }]) {
    assert.throws(() => validateFieldPayload(collaborationSchemas.send_message, { ...target, body: "Hello General." }), /Check the action details/);
  }
});

test("drawing schemas require explicit pages and complete pin, pen, cloud and measurement geometry", () => {
  const base = payloads.annotate_drawing;
  const invalid = [
    { ...base, pageNo: "2" }, { ...base, pageNo: 0 }, { ...base, pageNo: undefined },
    { ...base, geometry: { kind: "pin" } }, { ...base, geometry: { kind: "pin", at: { x: null, y: 20 } } },
    { ...base, kind: "pen", geometry: { kind: "pen", points: [{ x: 0, y: 10 }] } },
    { ...base, kind: "cloud", geometry: { kind: "cloud", rect: { x: 10, y: 20, w: 0, h: 20 } } },
    { ...base, kind: "measure", geometry: { kind: "measure", a: { x: 10, y: 20 } } },
  ];
  for (const payload of invalid) assert.throws(() => validateFieldPayload(collaborationSchemas.annotate_drawing, payload), /Check the action details/);
  for (const [kind, shape] of [
    ["pen", { points: [{ x: 0, y: 0 }, { x: 20, y: 30 }] }],
    ["cloud", { rect: { x: 10, y: 20, w: 20, h: 30 } }],
    ["measure", { a: { x: 10, y: 20 }, b: { x: 30, y: 40 } }],
  ] as const) assert.doesNotThrow(() => validateFieldPayload(collaborationSchemas.annotate_drawing, { ...base, kind, geometry: { kind, ...shape } }));
});

test("drawing follow-ups use canonical creation bodies and cannot provide a future pin ID", () => {
  for (const followUp of [
    { kind: "rfi", payload: { subject: "Opening width", question: "Please confirm the width." } },
    { kind: "create_material_approval", payload: { title: "Check sample", materialName: "Granite" } },
  ]) {
    assert.doesNotThrow(() => validateFieldPayload(collaborationSchemas.annotate_drawing, { ...payloads.annotate_drawing, followUp }));
    assert.throws(() => validateFieldPayload(collaborationSchemas.annotate_drawing, { ...payloads.annotate_drawing, followUp: { ...followUp, payload: { ...followUp.payload, sourceMarkupId: "future-guessed-pin" } } }), /Check the action details/);
  }
});
