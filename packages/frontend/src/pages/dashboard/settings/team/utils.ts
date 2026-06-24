import { type BadgeTone } from "@/components/atoms/badge";

const ROLE_TONES: Record<string, BadgeTone> = {
  owner: "accent",
  admin: "info",
  member: "neutral",
  viewer: "neutral",
};

export function roleTone(role: string): BadgeTone {
  return ROLE_TONES[role] ?? "success";
}

export function formatRoleLabel(role: string): string {
  return role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
