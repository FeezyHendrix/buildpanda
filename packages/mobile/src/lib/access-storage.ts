import { queryStorage } from "./query-storage";
import { projectAccess } from "./project-access-store";
import { storage } from "./storage";

export const SNAPSHOT_KEY = "buildpanda_project_access_v1";
export function clearSavedProjectAccess() {
  projectAccess.invalidate("unknown");
  storage.removeItem(SNAPSHOT_KEY);
  queryStorage.clearProtected();
}
