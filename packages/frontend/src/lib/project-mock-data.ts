export type RiskLevel = "Low" | "Medium" | "High";
export type ProjectStatus = "On Track" | "At Risk" | "Delayed";
export type PhaseStatus = "Done" | "InProgress" | "Pending";
export type UpdateCategory =
  | "Progress"
  | "Material Delivery"
  | "Inspections"
  | "Issues";
export type MediaType = "photo" | "video";
export type DocumentStatus = "Verified" | "Pending" | "Expired";
export type InspectionStatus =
  | "Action Required"
  | "Completed"
  | "Scheduled";
export type MilestoneStatus = "Completed" | "InProgress" | "Pending";
export type InspectionCategory =
  | "All Reports"
  | "Structural"
  | "Quantity Survey"
  | "General Progress"
  | "Electrical"
  | "Plumbing";

export interface Project {
  id: string;
  name: string;
  address: string;
  status: ProjectStatus;
  healthScore: number;
  risk: RiskLevel;
  progressPercent: number;
  budgetTotal: number;
  budgetUsed: number;
  currency: "NGN" | "USD";
  pendingApprovals: number;
  nextInspection: {
    type: string;
    date: string;
  };
  folderTone: "orange" | "brand" | "green" | "purple";
  lastUpdatedAt: string;
  timeline: ProjectPhase[];
}

export interface ProjectPhase {
  id: string;
  name: string;
  status: PhaseStatus;
  dateRange: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  initialsTone?: "orange" | "brand" | "green" | "purple" | "amber" | "red";
}

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  author: Person;
  category: UpdateCategory;
  title: string;
  description: string;
  media: MediaItem[];
  cta: { label: string; tone: "primary" | "secondary" };
  secondaryAction?: { label: string };
  createdAt: string;
}

export interface DocumentCategory {
  id: string;
  name: string;
  fileCount: number;
  totalSize: string;
  tone: "brand" | "orange" | "green" | "purple" | "amber" | "red";
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  fileName: string;
  size: string;
  category: string;
  uploadedAt: string;
  status: DocumentStatus;
}

export interface InspectionReport {
  id: string;
  projectId: string;
  inspector: Person;
  title: string;
  category: InspectionCategory;
  description: string;
  status: InspectionStatus;
  riskLevel: RiskLevel;
  scheduledAt: string;
  media: MediaItem[];
  reportUrl?: string;
}

export interface BudgetPhase {
  id: string;
  name: string;
  planned: number;
  actual: number;
}

export interface MaterialProcurement {
  id: string;
  name: string;
  purchasedAt: string;
  receipt: string;
  amount: number;
  thumbnailTone: "orange" | "brand" | "green" | "purple" | "amber";
}

export interface MilestonePayment {
  id: string;
  name: string;
  phase: string;
  status: MilestoneStatus;
  percentComplete: number;
  amount: number;
  proof: { fileName: string; verified: boolean } | null;
  inspectorSignOff: "Verified" | "Scheduled" | "Pending";
}

export interface PaymentLedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "Release" | "Deposit" | "Hold";
}

export interface ProjectFinances {
  projectId: string;
  currency: "NGN" | "USD";
  totalBudget: number;
  fundsDeposited: number;
  fundsReleased: number;
  lockedInEscrow: number;
  remainingBalance: number;
  budgetAllocation: BudgetPhase[];
  materialsProcured: MaterialProcurement[];
  milestones: MilestonePayment[];
  ledger: PaymentLedgerEntry[];
}

export interface RiskFactor {
  id: string;
  title: string;
  description: string;
  severity: RiskLevel;
}

export const PROJECTS: Project[] = [
  {
    id: "marbella",
    name: "Project Marbella",
    address: "30, John great court, Lekki, Lagos state",
    status: "On Track",
    healthScore: 92,
    risk: "Low",
    progressPercent: 12,
    budgetTotal: 45_000_000,
    budgetUsed: 3_300_500,
    currency: "NGN",
    pendingApprovals: 2,
    nextInspection: {
      type: "Structural Integrity",
      date: "April 12",
    },
    folderTone: "orange",
    lastUpdatedAt: "30 minutes ago",
    timeline: [
      { id: "p1", name: "Foundation", status: "Done", dateRange: "Jan – Feb" },
      {
        id: "p2",
        name: "Structural Shell",
        status: "InProgress",
        dateRange: "Mar – Apr",
      },
      {
        id: "p3",
        name: "Roofing & MEP",
        status: "Pending",
        dateRange: "May – Jun",
      },
      {
        id: "p4",
        name: "Interior Fit",
        status: "Pending",
        dateRange: "Jul – Aug",
      },
      {
        id: "p5",
        name: "Completion",
        status: "Pending",
        dateRange: "Sep – Oct",
      },
    ],
  },
];

const MEDIA_BASE = [
  "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=640&q=70",
];

function mediaSet(seed: number, count: number, type: MediaType = "photo"): MediaItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m-${seed}-${i}`,
    type: i === count - 1 && count > 2 ? type : "photo",
    url: MEDIA_BASE[(seed + i) % MEDIA_BASE.length]!,
  }));
}

export const UPDATES: ProjectUpdate[] = [
  {
    id: "u1",
    projectId: "marbella",
    author: {
      id: "p1",
      name: "Arinze Obi",
      role: "Lead Contractor",
      initialsTone: "orange",
    },
    category: "Progress",
    title: "Roofing installation started",
    description:
      "Roof framing complete, sheets being installed, and trusses being secured by the structural crew.",
    media: mediaSet(0, 3, "video"),
    cta: { label: "Approve", tone: "primary" },
    secondaryAction: { label: "Verify with Panda AI" },
    createdAt: "2026-04-21T10:15:00Z",
  },
  {
    id: "u2",
    projectId: "marbella",
    author: {
      id: "p2",
      name: "Tunde Bakare",
      role: "Site Inspector",
      initialsTone: "brand",
    },
    category: "Material Delivery",
    title: "Plumbing fixtures delivered",
    description:
      "German supplier fixtures inspected on-site, sorted by floor, and stored in the secure container.",
    media: mediaSet(2, 2),
    cta: { label: "Mark as Inspected", tone: "primary" },
    secondaryAction: { label: "View Report" },
    createdAt: "2026-04-20T14:30:00Z",
  },
  {
    id: "u3",
    projectId: "marbella",
    author: {
      id: "p3",
      name: "Engr. David Okonjo",
      role: "Structural Engineer",
      initialsTone: "purple",
    },
    category: "Inspections",
    title: "Structural Integrity Inspection – Foundation Phase",
    description:
      "Concrete strength tests and reinforcement alignment verified across all foundation grids.",
    media: [],
    cta: { label: "Approve", tone: "primary" },
    secondaryAction: { label: "View Report" },
    createdAt: "2026-04-19T09:00:00Z",
  },
  {
    id: "u4",
    projectId: "marbella",
    author: {
      id: "p2",
      name: "Tunde Bakare",
      role: "Site Inspector",
      initialsTone: "brand",
    },
    category: "Issues",
    title: "Drainage Blockage at North Perimeter",
    description:
      "Heavy rainfall caused the perimeter trench to block; landscaping crew paused until cleared.",
    media: mediaSet(1, 2),
    cta: { label: "View Resolution Plan", tone: "secondary" },
    secondaryAction: { label: "Escalation Details" },
    createdAt: "2026-04-18T16:45:00Z",
  },
];

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { id: "land", name: "Land Documents", fileCount: 12, totalSize: "4.2 MB", tone: "amber" },
  {
    id: "architectural",
    name: "Architectural Plans",
    fileCount: 28,
    totalSize: "156 MB",
    tone: "brand",
  },
  {
    id: "contracts",
    name: "Contracts & Agreements",
    fileCount: 12,
    totalSize: "4.2 MB",
    tone: "purple",
  },
  {
    id: "invoices",
    name: "Invoices & Receipts",
    fileCount: 142,
    totalSize: "22 MB",
    tone: "green",
  },
  {
    id: "approvals",
    name: "Government Approvals",
    fileCount: 5,
    totalSize: "3.8 MB",
    tone: "red",
  },
  {
    id: "inspections",
    name: "Inspection Certs",
    fileCount: 19,
    totalSize: "8.4 MB",
    tone: "orange",
  },
];

export const DOCUMENTS: ProjectDocument[] = [
  {
    id: "d1",
    projectId: "marbella",
    fileName: "C_of_O_Lagos_Villa.pdf",
    size: "4.2 MB",
    category: "Land Documents",
    uploadedAt: "Oct 24, 2023",
    status: "Verified",
  },
  {
    id: "d2",
    projectId: "marbella",
    fileName: "Main_Structure_RevB.dwg",
    size: "4.2 MB",
    category: "Architectural Plans",
    uploadedAt: "Oct 24, 2023",
    status: "Pending",
  },
  {
    id: "d3",
    projectId: "marbella",
    fileName: "Env_Impact_Permit_2023.jpg",
    size: "4.2 MB",
    category: "Government Approvals",
    uploadedAt: "Oct 24, 2023",
    status: "Verified",
  },
  {
    id: "d4",
    projectId: "marbella",
    fileName: "Site_Inspection_Q4.pdf",
    size: "4.2 MB",
    category: "Inspection Certs",
    uploadedAt: "Oct 24, 2023",
    status: "Pending",
  },
  {
    id: "d5",
    projectId: "marbella",
    fileName: "Env_Impact_Permit_2023.pdf",
    size: "4.2 MB",
    category: "Government Approvals",
    uploadedAt: "Oct 24, 2023",
    status: "Expired",
  },
];

export const INSPECTIONS: InspectionReport[] = [
  {
    id: "i1",
    projectId: "marbella",
    inspector: {
      id: "p3",
      name: "Engr. David Okonjo",
      role: "Structural Engineer",
      initialsTone: "purple",
    },
    title: "Structural Foundation Check",
    category: "Structural",
    description:
      "Roof framing complete, roofing sheets being installed, trusses secured by the structural crew.",
    status: "Action Required",
    riskLevel: "High",
    scheduledAt: "Oct 21, 2023 • 02:15 PM",
    media: mediaSet(3, 3, "video"),
    reportUrl: "#",
  },
  {
    id: "i2",
    projectId: "marbella",
    inspector: {
      id: "p3",
      name: "Engr. David Okonjo",
      role: "Structural Engineer",
      initialsTone: "purple",
    },
    title: "Structural Foundation Check",
    category: "Structural",
    description:
      "Foundation work passed all standard checks. Documentation has been filed with LASBCA.",
    status: "Completed",
    riskLevel: "Low",
    scheduledAt: "Oct 21, 2023 • 02:15 PM",
    media: mediaSet(0, 3, "video"),
    reportUrl: "#",
  },
];

export const RISK_FACTORS: RiskFactor[] = [];

export const FINANCES: Record<string, ProjectFinances> = {
  marbella: {
    projectId: "marbella",
    currency: "NGN",
    totalBudget: 45_300_500,
    fundsDeposited: 23_300_500,
    fundsReleased: 13_300_500,
    lockedInEscrow: 10_300_500,
    remainingBalance: 3_300_500,
    budgetAllocation: [
      { id: "ba1", name: "Foundation", planned: 4_445_000, actual: 4_402_300 },
      {
        id: "ba2",
        name: "Superstructure",
        planned: 8_880_000,
        actual: 8_888_500,
      },
      { id: "ba3", name: "Roofing", planned: 6_500_000, actual: 0 },
      { id: "ba4", name: "MEP", planned: 7_200_000, actual: 0 },
      { id: "ba5", name: "Finishing", planned: 9_500_000, actual: 0 },
      { id: "ba6", name: "Contingency", planned: 4_775_500, actual: 0 },
    ],
    materialsProcured: [
      {
        id: "mp1",
        name: "16mm Reinforcement Steel",
        purchasedAt: "11-04-2026, 11:12 AM",
        receipt: "reciept_INV-4029.jpeg",
        amount: 8_880_000,
        thumbnailTone: "brand",
      },
      {
        id: "mp2",
        name: "Dangote Grade 42.5 Cement",
        purchasedAt: "10-04-2026, 11:12 AM",
        receipt: "reciept_INV-4028.jpeg",
        amount: 4_880_000,
        thumbnailTone: "amber",
      },
      {
        id: "mp3",
        name: "Dangote Grade 32.5 Cement",
        purchasedAt: "10-04-2026, 9:12 AM",
        receipt: "reciept_INV-4027.jpeg",
        amount: 3_780_000,
        thumbnailTone: "orange",
      },
      {
        id: "mp4",
        name: "Dangote Grade 32.5 Cement",
        purchasedAt: "10-04-2026, 9:12 AM",
        receipt: "reciept_INV-4027.jpeg",
        amount: 3_780_000,
        thumbnailTone: "orange",
      },
      {
        id: "mp5",
        name: "Dangote Grade 32.5 Cement",
        purchasedAt: "10-04-2026, 9:12 AM",
        receipt: "reciept_INV-4027.jpeg",
        amount: 3_780_000,
        thumbnailTone: "orange",
      },
    ],
    milestones: [
      {
        id: "m1",
        name: "Main Roof Structure",
        phase: "Roofing",
        status: "Completed",
        percentComplete: 100,
        amount: 8_880_000,
        proof: { fileName: "inspection_report_R01.pdf", verified: true },
        inspectorSignOff: "Verified",
      },
      {
        id: "m2",
        name: "Electric Rough-in",
        phase: "Systems",
        status: "InProgress",
        percentComplete: 75,
        amount: 8_880_000,
        proof: null,
        inspectorSignOff: "Scheduled",
      },
      {
        id: "m3",
        name: "Electric Rough-in",
        phase: "Systems",
        status: "Pending",
        percentComplete: 0,
        amount: 0,
        proof: null,
        inspectorSignOff: "Pending",
      },
    ],
    ledger: [
      {
        id: "l1",
        date: "11-04-2026",
        description: "Release · Main Roof Structure",
        amount: 8_880_000,
        type: "Release",
      },
      {
        id: "l2",
        date: "01-04-2026",
        description: "Deposit · Project funding",
        amount: 23_300_500,
        type: "Deposit",
      },
      {
        id: "l3",
        date: "10-03-2026",
        description: "Hold · Electric Rough-in (escrow)",
        amount: 8_880_000,
        type: "Hold",
      },
    ],
  },
};
