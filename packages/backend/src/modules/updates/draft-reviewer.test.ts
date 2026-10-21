import assert from "node:assert/strict";
import { test } from "node:test";
import { notifyDraftReviewer } from "./draft-reviewer.ts";

test("generated update drafts notify only the accountable project owner", async () => {
  const sent: Array<{ userId: string; projectId: string | null | undefined }> = [];
  const notifications = {
    async notify(userId: string, _type: "update_draft_ready", input: { projectId?: string | null }) {
      sent.push({ userId, projectId: input.projectId });
    },
  };

  await notifyDraftReviewer(notifications, { owner_id: "project-owner" }, {
    title: "Draft ready",
    body: "Review it.",
    projectId: "project-1",
  });

  assert.deepEqual(sent, [{ userId: "project-owner", projectId: "project-1" }]);
});

test("a project without an owner does not broadcast its draft", async () => {
  let calls = 0;
  await notifyDraftReviewer({ async notify() { calls += 1; } }, { owner_id: null }, {
    title: "Draft ready",
    body: "Review it.",
  });
  assert.equal(calls, 0);
});
