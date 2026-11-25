import assert from "node:assert/strict";
import { accessSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

assert.ok(process.env.MESSAGING_AGENT_TEST_DATABASE_URL, "Set MESSAGING_AGENT_TEST_DATABASE_URL to an isolated, migrated PostgreSQL database.");
assert.ok(process.env.MESSAGING_AGENT_TEST_REDIS_URL, "Set MESSAGING_AGENT_TEST_REDIS_URL to an isolated Redis instance.");

const suites = [
  "modules/messaging-agent/document-analysis.test.ts",
  "modules/messaging-agent/document-conversation.test.ts",
  "modules/field-actions/financial-records-db.test.ts",
  "../../panda-agent/scripts/review-schema.test.ts",
  "modules/messaging-agent/artifacts.test.ts",
  "modules/field-actions/collaboration-db.test.ts",
  "modules/field-actions/collaboration.test.ts",
  "modules/field-actions/read-tools-db.test.ts",
  "modules/field-actions/site-records-db.test.ts",
  "modules/field-actions/site-records.test.ts",
  "modules/field-actions/work-coordination-db.test.ts",
  "modules/field-actions/work-coordination.test.ts",
  "modules/messaging-agent/attachment-media.test.ts",
  "modules/messaging-agent/attachments-db.test.ts",
  "modules/messaging-agent/field-tools.test.ts",
  "modules/messaging-agent/message-parts.test.ts",
  "modules/messaging-agent/review-access-db.test.ts",
  "modules/messaging-agent/tool-discovery.test.ts",

  "lib/public-webhooks.test.ts",
  "lib/queue/messaging-agent-lifecycle.test.ts",
  "modules/field-actions/validation.test.ts",
  "modules/field-actions/daily-log-db.test.ts",
  "modules/field-actions/material-log.test.ts",
  "modules/field-actions/material-log-db.test.ts",
  "modules/messaging-agent/adapters/whatsapp/signature.test.ts",
  "modules/messaging-agent/adapters/whatsapp/provider.test.ts",
  "modules/messaging-agent/migration.test.ts",
  "modules/messaging-agent/repository.test.ts",
  "modules/messaging-agent/draft.test.ts",
  "modules/messaging-agent/material-review.test.ts",
  "modules/messaging-agent/material-conversation.test.ts",
  "modules/messaging-agent/review-service.test.ts",
  "modules/messaging-agent/service.test.ts",
  "modules/messaging-agent/routes.test.ts",
  "modules/messaging-agent/adapters/whatsapp/webhook-routes.test.ts",
  "modules/messaging-agent/worker.test.ts",
  "modules/messaging-agent/recovery-service.test.ts",
  "modules/messaging-agent/runtime.test.ts",
  "modules/messaging-agent/adapters/whatsapp/adapter.test.ts",
  "modules/messaging-agent/portability.test.ts",
  "modules/messaging-agent/channels.test.ts",
  "modules/messaging-agent/mappers.test.ts",
  "modules/messaging-agent/reply-buttons.test.ts",
  "modules/messaging-agent/adapters/telegram/provider.test.ts",
  "modules/messaging-agent/adapters/telegram/normalize.test.ts",
  "modules/messaging-agent/adapters/telegram/webhook-routes.test.ts",
  "modules/messaging-agent/adapters/telegram/adapter.test.ts",
  "modules/messaging-agent/telegram-runtime.test.ts",
  "lib/sentry-messaging-secrets.test.ts",
  "../scripts/telegram-webhook.test.ts",
].map((path) => fileURLToPath(new URL(`../src/${path}`, import.meta.url)));
for (const suite of suites) accessSync(suite);
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", ...suites], {
  stdio: "inherit",
  env: { ...process.env, FIELD_ACTION_TEST_DATABASE_URL: process.env.FIELD_ACTION_TEST_DATABASE_URL ?? process.env.MESSAGING_AGENT_TEST_DATABASE_URL },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
