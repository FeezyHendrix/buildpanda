import assert from "node:assert/strict";
import { test } from "node:test";
import type { UploadedFileRow } from "../files/types.ts";
import type { ApprovalsRepository } from "./repository.ts";
import { approvalsService } from "./service.ts";
import type { ApprovalAttachmentRow, ApprovalRow } from "./types.ts";

const PROJECT = "prj_1";
const ME = "usr_me";

function file(id: string, over: Partial<UploadedFileRow> = {}): UploadedFileRow {
  return {
    id,
    owner_id: ME,
    project_id: PROJECT,
    file_name: `${id}.png`,
    mime_type: "image/png",
    size_bytes: 1000,
    storage_path: `/${id}`,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function harness(files: UploadedFileRow[], taken: string[] = []) {
  const inserted: { attachments: ApprovalAttachmentRow[] }[] = [];
  const rows: ApprovalRow[] = [];
  const repo = {
    async create(record: { id: string; title: string; project_id: string }, attachments: ApprovalAttachmentRow[] = []) {
      inserted.push({ attachments });
      const row = {
        ...record,
        kind: "client",
        status: "Pending",
        created_at: "now",
        updated_at: "now",
      } as unknown as ApprovalRow;
      rows.push(row);
      return row;
    },
    async findById(id: string) {
      return rows.find((r) => r.id === id);
    },
    async attachedFileIds(ids: string[]) {
      return ids.filter((id) => taken.includes(id));
    },
    async listAttachments(ids: string[]) {
      return inserted
        .flatMap((i) => i.attachments)
        .filter((a) => ids.includes(a.approval_id))
        .map((a) => ({ ...a, file: files.find((f) => f.id === a.file_id)! }));
    },
    async commentCounts() {
      return new Map<string, number>();
    },
  } as unknown as ApprovalsRepository;
  const service = approvalsService(repo, {
    files: {
      async findRows(ids: string[]) {
        return files.filter((f) => ids.includes(f.id));
      },
      async presignViewUrl(row: UploadedFileRow) {
        return `signed:${row.id}`;
      },
    },
  });
  return { service, inserted };
}

const create = (h: ReturnType<typeof harness>, fileIds: string[]) =>
  h.service.create(PROJECT, { title: "Tiles", attachments: fileIds.map((fileId) => ({ fileId })) }, ME);

test("create stores attachments in order and returns them signed", async () => {
  const h = harness([file("f1"), file("f2", { mime_type: "application/pdf" })]);
  const approval = await create(h, ["f1", "f2"]);
  assert.equal(approval.attachmentCount, 2);
  assert.deepEqual(
    approval.attachments.map((a) => [a.fileName, a.url]),
    [
      ["f1.png", "signed:f1"],
      ["f2.png", "signed:f2"],
    ],
  );
  assert.deepEqual(h.inserted[0]!.attachments.map((a) => a.position), [0, 1]);
});

test("create rejects files the caller cannot attach, before writing anything", async () => {
  const cases: [string, UploadedFileRow[], string[], RegExp][] = [
    ["someone else's file", [file("f1", { owner_id: "usr_other" })], ["f1"], /not one you uploaded/],
    ["another project's file", [file("f1", { project_id: "prj_2" })], ["f1"], /not one you uploaded/],
    ["unknown file", [], ["f9"], /not one you uploaded/],
    ["wrong type", [file("f1", { mime_type: "text/html" })], ["f1"], /only PNG, JPG or PDF/],
    ["too big", [file("f1", { size_bytes: 11 * 1024 * 1024 })], ["f1"], /10 MB/],
    ["duplicate", [file("f1")], ["f1", "f1"], /attached twice/],
    ["too many", [1, 2, 3, 4, 5, 6].map((n) => file(`f${n}`)), [1, 2, 3, 4, 5, 6].map((n) => `f${n}`), /At most 5/],
  ];
  for (const [name, files, ids, message] of cases) {
    const h = harness(files);
    await assert.rejects(create(h, ids), message, name);
    assert.equal(h.inserted.length, 0, `${name}: nothing written`);
  }
  const reused = harness([file("f1")], ["f1"]);
  await assert.rejects(create(reused, ["f1"]), /already attached/);
});

test("rejecting or requesting changes needs a note", async () => {
  const h = harness([]);
  const approval = await create(h, []);
  await assert.rejects(
    h.service.update(PROJECT, approval.id, { status: "Rejected" }, "usr_reviewer"),
    /note is required/,
  );
  await assert.rejects(
    h.service.update(PROJECT, approval.id, { status: "Resubmit", response: "  " }, "usr_reviewer"),
    /note is required/,
  );
});
