import {
  useMembers,
  useInvitations,
  useRoles,
} from "@/hooks/use-organization";

export type Member = NonNullable<
  ReturnType<typeof useMembers>["data"]
>["members"][number];

export type Invitation = NonNullable<ReturnType<typeof useInvitations>["data"]>[number];

export type CustomRole = NonNullable<ReturnType<typeof useRoles>["data"]>[number];
