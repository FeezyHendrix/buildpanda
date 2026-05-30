import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  plugins: [
    inferAdditionalFields({
      user: {
        country: { type: "string", required: false },
        phone: { type: "string", required: false },
      },
    }),
  ],
});
