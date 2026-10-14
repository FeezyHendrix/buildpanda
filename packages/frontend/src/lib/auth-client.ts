import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { payloadFetch } from "./payload-fetch";
import { ac, roles } from "./permissions";

// const hostname = window.location.hostname.split(".")[0];

// const baseURL =
//   hostname === "app"
//     ? import.meta.env.VITE_API_PROD_BASE_URL
//     : import.meta.env.VITE_API_DEV_BASE_URL;

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  // Auth replies (sessions, members, invitations) are encrypted like the rest
  // of the API on test and app.
  fetchOptions: { customFetchImpl: payloadFetch },
  plugins: [
    inferAdditionalFields({
      user: {
        country: { type: "string", required: false },
        phone: { type: "string", required: false },
        accountType: { type: "string", required: false },
        profession: { type: "string", required: false },
        companyName: { type: "string", required: false },
      },
    }),
    organizationClient({
      ac,
      roles,
      dynamicAccessControl: {
        enabled: true,
      },
    }),
  ],
});
