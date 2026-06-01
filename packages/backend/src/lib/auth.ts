import { betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { Pool } from "pg";
import { sendEmail } from "./mail.ts";
import { db } from "../db/connection.ts";
import { generateId } from "./ids.ts";
import { ac, roles } from "./permissions.ts";

const pool = new Pool({
  host: process.env["DB_HOST"] ?? "localhost",
  port: Number(process.env["DB_PORT"] ?? 5432),
  database: process.env["DB_NAME"] ?? "buildpanda",
  user: process.env["DB_USER"] ?? "postgres",
  password: process.env["DB_PASSWORD"] ?? "postgres",
});

const APP_URL = process.env["CORS_ORIGIN"] ?? "http://localhost:5173";

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
async function ensureUserOrganization(
  userId: string,
  knownName?: string,
): Promise<string> {
  const existing = await db("member")
    .where({ userId })
    .first<{ organizationId: string }>();
  if (existing) return existing.organizationId;

  let name = knownName;
  if (!name) {
    const user = await db("user")
      .where({ id: userId })
      .first<{ name: string }>();
    name = user?.name ?? "My";
  }

  const orgName = `${name}'s Company`;
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

const ADMIN_EMAILS = (process.env["ADMIN_EMAILS"] ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

/**
 * Bootstraps platform admins: if a user's email is allowlisted in ADMIN_EMAILS,
 * promote them to the global `admin` role at sign-in. Runs on session creation
 * so better-auth's session/getSession reflects the role immediately (the admin
 * UI gate reads the role from the session, before any /admin request is made).
 */
async function promoteIfAdminEmail(userId: string): Promise<void> {
  if (ADMIN_EMAILS.length === 0) return;
  const user = await db("user")
    .where({ id: userId })
    .first<{ email: string; role: string }>();
  if (user && user.role !== "admin" && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    await db("user").where({ id: userId }).update({ role: "admin" });
  }
}

export const auth = betterAuth({
  database: pool,
  secret: process.env["BETTER_AUTH_SECRET"],
  baseURL: process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000",
  basePath: "/api/auth",
  trustedOrigins: (
    process.env["CORS_ORIGIN"] ?? "http://localhost:5173,http://localhost:5174"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: false,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        toName: user.name,
        subject: "Reset your password",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #111827;">Reset your password</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Hi ${user.name},<br/>
              We received a request to reset your password. Click the button below to choose a new one.
            </p>
            <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #004DE7; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
              Reset Password
            </a>
            <p style="color: #9ca3af; font-size: 14px; line-height: 1.5;">
              If you didn't request a password reset, you can safely ignore this email. The link expires in 1 hour.
            </p>
          </div>
        `,
      });
    },
    resetPasswordTokenExpiresIn: 3600,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        toName: user.name,
        subject: "Verify your email address",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #111827;">Verify your email</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Hi ${user.name},<br/>
              Thanks for signing up for BuildPanda! Please verify your email address by clicking the button below.
            </p>
            <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #004DE7; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
              Verify Email
            </a>
            <p style="color: #9ca3af; font-size: 14px; line-height: 1.5;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
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
    organization({
      ac,
      roles,
      dynamicAccessControl: {
        enabled: true,
      },
      sendInvitationEmail: async (data) => {
        const inviteUrl = `${APP_URL}/accept-invitation/${data.id}`;
        await sendEmail({
          to: data.email,
          toName: data.email,
          subject: `You're invited to join ${data.organization.name} on BuildPanda`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #111827;">Join ${data.organization.name}</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                ${data.inviter.user.name} invited you to collaborate on
                ${data.organization.name} in BuildPanda. Click below to accept.
              </p>
              <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #004DE7; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
                Accept Invitation
              </a>
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.5;">
                If you weren't expecting this invitation, you can ignore this email.
              </p>
            </div>
          `,
        });
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
          await ensureUserOrganization(user.id, user.name);
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const activeOrganizationId = await ensureUserOrganization(
            session.userId,
          );
          await promoteIfAdminEmail(session.userId);
          return { data: { ...session, activeOrganizationId } };
        },
      },
    },
  },
});
