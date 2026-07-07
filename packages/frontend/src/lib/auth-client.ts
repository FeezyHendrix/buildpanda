import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { ac, roles } from "./permissions";

// const hostname = window.location.hostname.split(".")[0];

// const baseURL =
//   hostname === "app"
//     ? import.meta.env.VITE_API_PROD_BASE_URL
//     : import.meta.env.VITE_API_DEV_BASE_URL;

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
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
