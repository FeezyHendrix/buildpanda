export interface AdminSignupJourney {
  asOf: string;
  total: number;
  funnel: { step: string; value: number; conversionPct: number }[];
  lastSeen: { label: string; value: number }[];
  activation: { eligible: number; activated: number };
  timeToValue: { medianHours: number | null; buckets: { label: string; value: number }[] };
  actions: {
    label: string;
    users: number;
    weekOne: number;
    weekOneCameBack: number;
    others: number;
    othersCameBack: number;
  }[];
  segments: { group: string; segment: string; signups: number; started: number; worked: number }[];
  stalled: {
    id: string;
    name: string;
    email: string;
    accountType: string | null;
    country: string | null;
    invited: boolean;
    createdAt: string;
    lastActivityAt: string | null;
    step: string;
  }[];
}
