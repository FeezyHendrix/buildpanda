import { createAuthClient } from "better-auth/react";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  plugins: [
    inferAdditionalFields({
      user: {
        country: { type: "string", required: false },
        phone: { type: "string", required: false },
        accountType: { type: "string", required: false },
        profession: { type: "string", required: false },
        role: { type: "string", required: false },
      },
    }),
    adminClient(),
  ],
});

export type SessionUser = typeof authClient.$Infer.Session.user;
