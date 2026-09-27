import { authClient } from "@/lib/auth-client";

export class AuthRecoveryError extends Error {
  constructor(public code: string | undefined, message: string) { super(message); }
}

function check(error: { code?: string; message?: string } | null) {
  if (error) throw new AuthRecoveryError(error.code, error.message ?? "Could not reach the server. Please try again.");
}

export function isInvalidRecoveryLink(error: unknown) {
  return error instanceof AuthRecoveryError && ["INVALID_TOKEN", "TOKEN_EXPIRED", "USER_NOT_FOUND"].includes(error.code ?? "");
}

export const authRecoveryApi = {
  verify: async (token: string) => {
    const result = await authClient.verifyEmail({ query: { token } });
    check(result.error);
    // A session lookup failure must not turn successful verification into a failed link.
    const session = await authClient.getSession({ query: { disableCookieCache: true } }).catch(() => null);
    return session?.data ?? null;
  },
  resend: async (input: { email: string; callbackURL: string }) => {
    const result = await authClient.sendVerificationEmail(input);
    check(result.error);
  },
  requestReset: async (input: { email: string; redirectTo: string }) => {
    const result = await authClient.requestPasswordReset(input);
    check(result.error);
  },
  resetPassword: async (input: { token: string; newPassword: string }) => {
    const result = await authClient.resetPassword(input);
    check(result.error);
  },
};
