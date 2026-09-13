import { test } from "node:test";
import assert from "node:assert/strict";
import type { Knex } from "knex";
import { invoiceNotifier } from "./invoice-notifier.ts";
import { NOTIFICATION_TYPES } from "../notifications/types.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { InvoiceRow } from "./types.ts";

const ACTOR = { id: "usr_qs", name: "QA Reviewer" };

const INVOICE = { number: "IS2-IPC-001", trade: "Main works" } as InvoiceRow;

interface Sent {
  userId: string;
  type: string;
  title: string;
  body: string;
}

/**
 * A stand-in for the two reads the notifier makes: the project owner and the
 * active participants with their grants. No Knex, no database — the audience
 * rule is the thing under test.
 */
function fakeDb(
  ownerId: string | null,
  participants: Array<{ user_id: string; role: string; grants: Record<string, string[]> | null }>,
): Knex {
  return ((table: string) => {
    if (table === "projects") {
      return {
        where: () => ({ select: () => ({ first: async () => ({ owner_id: ownerId }) }) }),
      };
    }
    return {
      where: () => ({
        whereNotNull: () => ({ select: async () => participants }),
      }),
    };
  }) as unknown as Knex;
}

function fakeNotifications(sent: Sent[]): NotificationsService {
  return {
    notify: async (userId: string, type: string, input: { title: string; body: string }) => {
      sent.push({ userId, type, title: input.title, body: input.body });
    },
  } as unknown as NotificationsService;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test("every new finance notification type is registered in the catalogue", () => {
  const registered = new Set(NOTIFICATION_TYPES.map((t) => t.type));
  for (const type of [
    "invoice_sent",
    "invoice_queried",
    "invoice_approved",
    "invoice_paid",
    "invoice_paid_late",
    "invoice_voided",
    "change_request_submitted",
    "change_request_approved",
    "change_request_rejected",
    "eot_submitted",
    "eot_decided",
  ]) {
    assert.ok(registered.has(type as never), `${type} is not in the notification catalogue`);
  }
});

test("a client query reaches the owner and everyone who may read the finance surface", async () => {
  const sent: Sent[] = [];
  const notifier = invoiceNotifier(
    fakeNotifications(sent),
    fakeDb("usr_owner", [
      { user_id: "usr_pm", role: "project_manager", grants: { finances: ["view", "viewCosts"] } },
      { user_id: "usr_foreman", role: "foreman", grants: { materials: ["view"] } },
    ]),
  );

  notifier.statusChanged("prj_1", INVOICE, "queried", ACTOR, "Culvert 2 measurement disputed");
  await flush();

  assert.deepEqual(
    sent.map((s) => s.userId).sort(),
    ["usr_owner", "usr_pm"],
  );
  assert.equal(sent[0]?.type, "invoice_queried");
  assert.equal(sent[0]?.body, "IS2-IPC-001 — Culvert 2 measurement disputed");
  // The foreman has no finance grant, so a certificate query is not their news.
  assert.equal(sent.some((s) => s.userId === "usr_foreman"), false);
});

test("the person who made the change is never notified about their own action", async () => {
  const sent: Sent[] = [];
  const notifier = invoiceNotifier(
    fakeNotifications(sent),
    fakeDb(ACTOR.id, [{ user_id: ACTOR.id, role: "project_manager", grants: null }]),
  );
  notifier.statusChanged("prj_1", INVOICE, "approved", ACTOR, null);
  await flush();
  assert.deepEqual(sent, []);
});

test("a receipt recorded after the due date is its own signal", async () => {
  const sent: Sent[] = [];
  const notifier = invoiceNotifier(
    fakeNotifications(sent),
    fakeDb("usr_owner", []),
  );
  notifier.paidLate("prj_1", INVOICE, 11, ACTOR);
  await flush();
  assert.equal(sent[0]?.type, "invoice_paid_late");
  assert.equal(sent[0]?.body, "IS2-IPC-001 — paid 11 days after the due date");
});

test("an event with no notification of its own stays silent", async () => {
  const sent: Sent[] = [];
  const notifier = invoiceNotifier(fakeNotifications(sent), fakeDb("usr_owner", []));
  notifier.statusChanged("prj_1", INVOICE, "created", ACTOR, null);
  await flush();
  assert.deepEqual(sent, []);
});
