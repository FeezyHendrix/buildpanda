import { request } from "./client";

export const authApi = {
  async signIn(email: string, password: string): Promise<void> {
    try {
      await request("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) });
    } catch {
      throw new Error("We could not sign you in. Check your email and password. If your account needs email verification or recovery, open BuildPanda for help.");
    }
  },
  async signOut(): Promise<void> {
    try {
      await request("/api/auth/sign-out", { method: "POST", body: "{}" });
    } catch {
      throw new Error("We could not sign you out. Please try again.");
    }
  },
};
