import { ApiClient } from "./api-client";
import { db } from "./db";
import { env } from "../config/env";
import { uniqueEmail, uniqueName } from "./ids";

export interface ProvisionedUser {
  email: string;
  password: string;
  name: string;
  userId: string;
  organizationId: string;
  cookie: string;
}

// Provisions a fully-authenticated user end to end:
//   1. sign-up via Better Auth (POST /api/auth/sign-up/email)
//   2. flip `emailVerified=true` via Knex — Better Auth has
//      requireEmailVerification:true, so an unverified user cannot sign in
//   3. sign-in to obtain a real session cookie; the session hook
//      (ensureUserOrganization) auto-creates an org and makes the user its owner
// The org id is then read back from the `member` table.
export async function provisionUser(role: string): Promise<ProvisionedUser> {
  const email = uniqueEmail(role);
  const name = uniqueName(`E2E ${role}`);
  const password = env.password;
  const api = new ApiClient();

  const signup = await api.post<{ user?: { id?: string } }>(
    "/api/auth/sign-up/email",
    { email, password, name },
  );
  if (!signup.ok) {
    throw new Error(`sign-up failed ${signup.status}: ${JSON.stringify(signup.body)}`);
  }

  const userRow = await db()("user").where({ email }).first<{ id: string }>();
  if (!userRow) throw new Error(`user not found after sign-up: ${email}`);
  await db()("user").where({ id: userRow.id }).update({ emailVerified: true });

  const signin = await api.post("/api/auth/sign-in/email", { email, password });
  if (!signin.ok) {
    throw new Error(`sign-in failed ${signin.status}: ${JSON.stringify(signin.body)}`);
  }
  const cookie = api.getCookie();
  if (!cookie) throw new Error("no session cookie after sign-in");

  // The session hook provisions the org lazily on first authenticated session;
  // sign-in above triggered it. Read the owning membership back.
  const member = await db()("member")
    .where({ userId: userRow.id })
    .first<{ organizationId: string }>();
  if (!member) throw new Error(`no organization for user ${email}`);

  return {
    email,
    password,
    name,
    userId: userRow.id,
    organizationId: member.organizationId,
    cookie,
  };
}

// Re-authenticates an already-provisioned user (e.g. for an API client in a
// spec that needs its own seeded session distinct from the browser's).
export async function signIn(email: string, password: string): Promise<ApiClient> {
  const api = new ApiClient();
  const res = await api.post("/api/auth/sign-in/email", { email, password });
  if (!res.ok) throw new Error(`sign-in failed ${res.status}: ${JSON.stringify(res.body)}`);
  return api;
}
