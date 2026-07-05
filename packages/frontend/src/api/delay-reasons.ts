import api from "./client";
import type { DelayReason } from "@/lib/project-types";

export const delayReasonsApi = {
  list: () => api.get<DelayReason[]>("/delay-reasons").then((r) => r.data),
};
