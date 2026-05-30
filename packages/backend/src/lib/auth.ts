import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { sendEmail } from "./mail.js";

const pool = new Pool({
  host: process.env["DB_HOST"] ?? "localhost",
  port: Number(process.env["DB_PORT"] ?? 5432),
  database: process.env["DB_NAME"] ?? "buildpanda",
  user: process.env["DB_USER"] ?? "postgres",
  password: process.env["DB_PASSWORD"] ?? "postgres",
});

export const auth = betterAuth({
  database: pool,
  secret: process.env["BETTER_AUTH_SECRET"],
  baseURL: process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000",
  basePath: "/api/auth",
  trustedOrigins: [
    process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  ],

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
});
