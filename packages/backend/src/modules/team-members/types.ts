export type TeamMemberStatus = "Active" | "Inactive";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  responsibilities: string | null;
  status: TeamMemberStatus;
}

export interface TeamMemberRow {
  id: string;
  project_id: string;
  name: string;
  role: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  responsibilities: string | null;
  status: TeamMemberStatus;
  created_at: Date | string;
}
