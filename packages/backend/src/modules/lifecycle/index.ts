import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { sendEmail } from "../../lib/mail.ts";
import { generateId } from "../../lib/ids.ts";
import { logger } from "../../lib/logger.ts";
import {
  welcomeEmail,
  activationNudgeEmail,
  firstProjectEmail,
  reEngagementEmail,
  type LifecycleEmailType,
} from "../../lib/lifecycle-emails.ts";

export const LIFECYCLE_EMAIL_QUEUE = "lifecycle-email-sweep";

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const ACTIVATION_AFTER_DAYS = 3;
const REENGAGE_AFTER_DAYS = 14;
const REENGAGE_INACTIVE_DAYS = 10;

interface RecipientRow {
  user_id: string;
  email: string;
  name: string | null;
  company_name: string | null;
}

function firstName(name: string | null): string {
  const trimmed = (name ?? "").trim();
  if (trimmed === "") return "there";
  return trimmed.split(/\s+/)[0]!;
}

function companyName(name: string | null): string {
  const trimmed = (name ?? "").trim();
  return trimmed === "" ? "your company" : trimmed;
}

function recipientQuery(db: Knex) {
  return db("user as u")
    .leftJoin("member as m", "m.userId", "u.id")
    .leftJoin("organization as o", "o.id", "m.organizationId")
    .select<RecipientRow[]>(
      "u.id as user_id",
      "u.email as email",
      "u.name as name",
      "o.name as company_name",
    );
}

async function alreadySent(db: Knex, userId: string, type: LifecycleEmailType): Promise<boolean> {
  const row = await db("lifecycle_emails").where({ user_id: userId, email_type: type }).first();
  return Boolean(row);
}

async function recordSent(db: Knex, userId: string, type: LifecycleEmailType): Promise<void> {
  await db("lifecycle_emails")
    .insert({ id: generateId("lce"), user_id: userId, email_type: type })
    .onConflict(["user_id", "email_type"])
    .ignore();
}

async function deliver(
  db: Knex,
  recipient: RecipientRow,
  type: LifecycleEmailType,
  build: (r: { firstName: string; companyName: string }) => {
    subject: string;
    html: string;
    from: { address: string; name: string };
    replyTo: { address: string; name: string };
  },
): Promise<void> {
  if (!recipient.email) return;
  if (await alreadySent(db, recipient.user_id, type)) return;

  const tpl = build({
    firstName: firstName(recipient.name),
    companyName: companyName(recipient.company_name),
  });
  try {
    await sendEmail({
      to: recipient.email,
      toName: recipient.name ?? undefined,
      subject: tpl.subject,
      html: tpl.html,
      from: tpl.from,
      replyTo: tpl.replyTo,
    });
    await recordSent(db, recipient.user_id, type);
  } catch (error) {
    logger.error({ error, userId: recipient.user_id, type }, "[lifecycle] send failed");
  }
}

async function projectCount(db: Knex, userId: string): Promise<number> {
  const row = await db("projects as p")
    .leftJoin("member as m", "m.organizationId", "p.organization_id")
    .where("m.userId", userId)
    .orWhere("p.owner_id", userId)
    .countDistinct<{ count: string }>("p.id as count")
    .first();
  return Number(row?.count ?? 0);
}

export async function sendWelcomeEmail(db: Knex, userId: string): Promise<void> {
  const recipient = await recipientQuery(db).where("u.id", userId).first();
  if (recipient) await deliver(db, recipient, "welcome", welcomeEmail);
}

export async function sendFirstProjectEmail(db: Knex, userId: string): Promise<void> {
  const recipient = await recipientQuery(db).where("u.id", userId).first();
  if (recipient) await deliver(db, recipient, "first_project", firstProjectEmail);
}

export async function runLifecycleSweep(db: Knex): Promise<void> {
  const now = Date.now();
  const activationCutoff = new Date(now - ACTIVATION_AFTER_DAYS * 86_400_000).toISOString();
  const reengageCutoff = new Date(now - REENGAGE_AFTER_DAYS * 86_400_000).toISOString();
  const inactiveCutoff = new Date(now - REENGAGE_INACTIVE_DAYS * 86_400_000).toISOString();

  const firstProjectCandidates = await recipientQuery(db).whereNotIn(
    "u.id",
    db("lifecycle_emails").select("user_id").where("email_type", "first_project"),
  );
  for (const r of firstProjectCandidates) {
    if ((await projectCount(db, r.user_id)) > 0) {
      await deliver(db, r, "first_project", firstProjectEmail);
    }
  }

  const activationCandidates = await recipientQuery(db)
    .where("u.createdAt", "<=", activationCutoff)
    .whereNotIn(
      "u.id",
      db("lifecycle_emails").select("user_id").where("email_type", "activation_nudge"),
    );
  for (const r of activationCandidates) {
    if ((await projectCount(db, r.user_id)) === 0) {
      await deliver(db, r, "activation_nudge", activationNudgeEmail);
    }
  }

  const reengageCandidates = await recipientQuery(db)
    .where("u.createdAt", "<=", reengageCutoff)
    .whereNotIn(
      "u.id",
      db("lifecycle_emails").select("user_id").where("email_type", "re_engagement"),
    );
  for (const r of reengageCandidates) {
    const count = await projectCount(db, r.user_id);
    const lastSession = await db("session")
      .where("userId", r.user_id)
      .max<{ last: string | null }[]>("updatedAt as last")
      .first();
    const inactive = !lastSession?.last || lastSession.last < inactiveCutoff;
    if (count === 0 || inactive) {
      await deliver(db, r, "re_engagement", reEngagementEmail);
    }
  }
}

export function registerLifecycleEmailWorker(db: Knex, manager: QueueManager): void {
  manager.startRepeating<{ _tick: number }>(
    LIFECYCLE_EMAIL_QUEUE,
    SWEEP_INTERVAL_MS,
    () => runLifecycleSweep(db),
    { _tick: 0 },
  );
}
