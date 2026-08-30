import { betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { Pool } from "pg";
import { config } from "../config/index.ts";
import { sendEmail } from "./mail.ts";
import { sendWelcomeEmail } from "../modules/lifecycle/index.ts";
import { getRequestContext } from "./request-context.ts";
import {
  organizationInviteEmail,
  passwordResetEmail,
  verificationEmail,
} from "./email-templates.ts";
import { db } from "../db/connection.ts";
import { generateId } from "./ids.ts";
import { ac, isEmployeeRole, roles } from "./permissions.ts";

const pool =
  "connectionString" in config.db
    ? new Pool({ connectionString: config.db.connectionString })
    : new Pool(config.db);

function appUrlFor(path: string, params: Record<string, string> = {}): string {
  const url = new URL(path, config.mail.appUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "company"
  );
}

async function uniqueOrgSlug(base: string): Promise<string> {
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await db("organization").where({ slug }).first();
    if (!existing) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${generateId().slice(0, 8)}`;
}

/**
 * Ensures the user belongs to a company (organization). The first user of a
 * company becomes its owner. Returns the user's active organization id.
 * Idempotent: if the user already has a membership, that org is returned.
 */
export async function ensureUserOrganization(
  userId: string,
  knownName?: string,
  companyName?: string | null,
): Promise<string> {
  const existing = await db("member")
    .where({ userId })
    .first<{ organizationId: string }>();
  if (existing) return existing.organizationId;

  // A construction firm's own company name becomes the workspace name verbatim
  // (e.g. "Acme Construction"). Otherwise fall back to "<person>'s Workspace".
  const trimmedCompany = companyName?.trim();
  let orgName: string;
  if (trimmedCompany) {
    orgName = trimmedCompany;
  } else {
    let name = knownName;
    if (!name) {
      const user = await db("user")
        .where({ id: userId })
        .first<{ name: string }>();
      name = user?.name ?? "My";
    }
    orgName = `${name}'s Workspace`;
  }
  const orgId = generateId("org");
  const slug = await uniqueOrgSlug(slugify(orgName));
  const now = new Date();

  await db("organization").insert({
    id: orgId,
    name: orgName,
    slug,
    createdAt: now,
    updatedAt: now,
  });
  await db("member").insert({
    id: generateId("mem"),
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: now,
  });

  return orgId;
}

/**
 * True if there is a pending, non-expired org invitation for this email.
 * Used at sign-up to skip creating a personal workspace for someone who is
 * about to join an existing org once they verify their email.
 */
async function hasPendingInvitation(email: string): Promise<boolean> {
  const now = new Date();
  const row = await db("invitation")
    .whereRaw("lower(email) = ?", [email.toLowerCase()])
    .andWhere({ status: "pending" })
    .andWhere((q) => q.whereNull("expiresAt").orWhere("expiresAt", ">", now))
    .first("id");
  return Boolean(row);
}

/**
 * Accepts every pending, non-expired invitation matching the user's (now
 * verified) email: inserts the membership with the invitation's role and marks
 * the invitation accepted. Runs only AFTER email verification so an unverified
 * sign-up with someone else's invited address never gains membership. If any
 * accepted invitation is an employee role, stamps user.accountType="employee"
 * (presentation only). Returns true if at least one invitation was accepted.
 */
async function acceptPendingInvitationsForEmail(
  userId: string,
  email: string,
): Promise<boolean> {
  const now = new Date();
  const normalizedEmail = email.toLowerCase();
  const pending = await db("invitation")
    .whereRaw("lower(email) = ?", [normalizedEmail])
    .andWhere({ status: "pending" })
    .andWhere((q) => q.whereNull("expiresAt").orWhere("expiresAt", ">", now))
    .select<{ id: string; organizationId: string; role: string | null }[]>(
      "id",
      "organizationId",
      "role",
    );
  if (pending.length === 0) return false;

  let joinedAsEmployee = false;
  await db.transaction(async (trx) => {
    for (const invite of pending) {
      const role = invite.role ?? "member";
      if (isEmployeeRole(role)) joinedAsEmployee = true;
      const alreadyMember = await trx("member")
        .where({ userId, organizationId: invite.organizationId })
        .first("id");
      if (!alreadyMember) {
        await trx("member").insert({
          id: generateId("mem"),
          organizationId: invite.organizationId,
          userId,
          role,
          createdAt: now,
        });
      }
      await trx("invitation").where({ id: invite.id }).update({ status: "accepted" });
    }
  });

  if (joinedAsEmployee) {
    await db("user").where({ id: userId }).update({ accountType: "employee" });
  }

  return true;
}

/**
 * Resolves the active organization for a new session. Prefers the org the
 * user last had active (so switching orgs or accepting an invitation sticks
 * across sign-ins) as long as they are still a member; otherwise falls back
 * to ensureUserOrganization's first-membership/auto-create behaviour.
 */
async function resolveActiveOrganization(userId: string): Promise<string> {
  const last = await db("session")
    .where({ userId })
    .whereNotNull("activeOrganizationId")
    .orderBy("createdAt", "desc")
    .first<{ activeOrganizationId: string | null }>("activeOrganizationId");
  if (last?.activeOrganizationId) {
    const stillMember = await db("member")
      .where({ userId, organizationId: last.activeOrganizationId })
      .first("id");
    if (stillMember) return last.activeOrganizationId;
  }
  return ensureUserOrganization(userId);
}

/**
 * Bootstraps platform admins: if a user's email is allowlisted in ADMIN_EMAILS,
 * promote them to the global `admin` role at sign-in. Runs on session creation
 * so better-auth's session/getSession reflects the role immediately (the admin
 * UI gate reads the role from the session, before any /admin request is made).
 */
async function promoteIfAdminEmail(userId: string): Promise<void> {
  if (config.adminEmails.length === 0) return;
  const user = await db("user")
    .where({ id: userId })
    .first<{ email: string; role: string }>();
  if (user && user.role !== "admin" && config.adminEmails.includes(user.email.toLowerCase())) {
    await db("user").where({ id: userId }).update({ role: "admin" });
  }
}

export const auth = betterAuth({
  database: pool,
  secret: config.auth.secret,
  baseURL: config.auth.baseUrl,
  basePath: "/api/auth",
  // The native app has no browser origin, so it identifies itself by URL scheme.
  // `exp://` covers Expo Go / dev clients on a LAN address and stays out of prod.
  trustedOrigins: [
    ...config.http.corsOrigins,
    "buildpanda://",
    ...(config.isProduction ? [] : ["exp://", "exp://**"]),
  ],

  // better-auth owns rate limiting for /api/auth/* (the Fastify limiter
  // deliberately skips these to avoid double-counting). Custom rules throttle
  // the brute-force-sensitive endpoints harder than the default window.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 5 },
    },
  },

  // Allow cookies on cross-site requests (e.g. localhost frontend hitting the
  // Railway-hosted API at api.buildpanda.io). When the frontend ever lives on
  // a sibling subdomain of the API, switch to `advanced.crossSubDomainCookies`
  // and drop SameSite=None.
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: true,
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: false,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // better-auth's `url` points at the API and 302s to a callbackURL that
      // resolves against the API origin too — broken when the SPA lives on a
      // different host. Rewrite to the app's own reset page (which calls the
      // API directly via authClient.resetPassword).
      const token = new URL(url).pathname.split("/").pop() ?? "";
      const frontendUrl = appUrlFor("/auth/reset-password", { token });
      const { subject, html } = passwordResetEmail({ name: user.name, url: frontendUrl });
      await sendEmail({ to: user.email, toName: user.name, subject, html });
    },
    resetPasswordTokenExpiresIn: 3600,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Same redirect problem as sendResetPassword: rewrite to the SPA route.
      const token = new URL(url).searchParams.get("token") ?? "";
      const frontendUrl = appUrlFor("/auth/verify-email", { token });
      const { subject, html } = verificationEmail({ name: user.name, url: frontendUrl });
      await sendEmail({ to: user.email, toName: user.name, subject, html });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    afterEmailVerification: async (user) => {
      // Email is now proven: accept any pending invitations (joins the inviting
      // workspace, stamps accountType=employee for employee invites). If the
      // invite was cancelled between sign-up and verification the user may still
      // have no org, so fall back to a personal workspace.
      const joinedViaInvite = await acceptPendingInvitationsForEmail(user.id, user.email);
      if (joinedViaInvite) {
        const membership = await db("member").where({ userId: user.id }).first("id");
        if (!membership) await ensureUserOrganization(user.id, user.name);
      }
      void sendWelcomeEmail(db, user.id).catch(() => undefined);
    },
  },

  socialProviders: {
    google: {
      clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
    },
  },

  user: {
    additionalFields: {
      country: {
        type: "string",
        required: false,
        input: true,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      accountType: {
        type: "string",
        required: false,
        input: true,
      },
      profession: {
        type: "string",
        required: false,
        input: true,
      },
      companyName: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 300, // 5 minutes
    },
  },

  plugins: [
    expo(),
    organization({
      ac,
      roles,
      dynamicAccessControl: {
        enabled: true,
      },
      sendInvitationEmail: async (data) => {
        const { subject, html } = organizationInviteEmail({
          inviterName: data.inviter.user.name,
          organizationName: data.organization.name,
          url: appUrlFor(`/accept-invitation/${data.id}`),
        });
        await sendEmail({ to: data.email, subject, html });
      },
    }),
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      // 1 hour impersonation sessions for support/debugging.
      impersonationSessionDuration: 60 * 60,
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Defer invitation acceptance to afterEmailVerification (an unverified
          // sign-up with someone else's invited email must not gain membership).
          // Only auto-create a personal workspace for users with NO pending
          // invite, so an invited employee never lands in their own empty org.
          const invited = await hasPendingInvitation(user.email);
          if (!invited) {
            const companyName = (user as { companyName?: string | null }).companyName ?? null;
            await ensureUserOrganization(user.id, user.name, companyName);
          }
          const ctx = getRequestContext();
          if (ctx && (ctx.ip || ctx.country)) {
            await db("user")
              .where({ id: user.id })
              .update({ signup_ip: ctx.ip, signup_country: ctx.country })
              .catch(() => undefined);
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const activeOrganizationId = await resolveActiveOrganization(
            session.userId,
          );
          await promoteIfAdminEmail(session.userId);
          return { data: { ...session, activeOrganizationId } };
        },
      },
    },
  },
});
