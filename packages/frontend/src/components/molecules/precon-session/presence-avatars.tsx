import { Avatar } from "@/components/atoms/avatar";
import type { PresenceUser } from "@/api/precon";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 5;

/**
 * WS-M3B. Everyone on the take-off right now, as a stack of initials. The
 * current user is included but marked, so a lone estimator sees one avatar
 * and knows it is theirs.
 */
export function PresenceAvatars({ users, currentUserId }: { users: PresenceUser[]; currentUserId: string | null }) {
  if (users.length === 0) return null;
  const shown = users.slice(0, MAX_SHOWN);
  const overflow = users.length - shown.length;
  const label = users.length === 1 ? "1 person on this take-off" : `${users.length} people on this take-off`;
  return (
    <div className="flex items-center" role="group" aria-label={label} title={users.map((u) => (u.id === currentUserId ? `${u.name} (you)` : u.name)).join(", ")}>
      {shown.map((user, index) => (
        <Avatar
          key={user.id}
          name={user.name}
          size="sm"
          className={cn("ring-2 ring-white", index > 0 && "-ml-2", user.id === currentUserId && "bg-gray-500")}
        />
      ))}
      {overflow > 0 ? (
        <span className="-ml-2 inline-flex size-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 ring-2 ring-white">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
PresenceAvatars.displayName = "PresenceAvatars";

/** The tiny avatar a bill row wears when someone else has it selected. */
export function RowFocusAvatars({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;
  const names = users.map((u) => u.name).join(", ");
  return (
    <span className="inline-flex shrink-0 items-center" title={`${names} ${users.length === 1 ? "is" : "are"} on this line`} aria-label={`${names} on this line`}>
      {users.slice(0, 3).map((user, index) => (
        <Avatar key={user.id} name={user.name} size="sm" className={cn("size-5 text-[9px] ring-1 ring-white", index > 0 && "-ml-1.5")} />
      ))}
    </span>
  );
}
RowFocusAvatars.displayName = "RowFocusAvatars";
