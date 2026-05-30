import { ForbiddenError } from "./errors.ts";

interface OwnedResource {
  ownerId: string | null;
}

interface AuthenticatedUser {
  id: string;
}

export function assertCanModify(
  resource: OwnedResource,
  user: AuthenticatedUser,
): void {
  if (resource.ownerId === null) return;
  if (resource.ownerId === user.id) return;
  throw new ForbiddenError("You do not have access to modify this resource");
}
