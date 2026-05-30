import { authClient } from "@/lib/auth-client";

export const useSession = authClient.useSession;

export type Session = typeof authClient.$Infer.Session;
