import { randomUUID } from "node:crypto";
import type { Knex } from "knex";

const PROJECT_ID = "sample-project";
const BUILDING_ID = `bld_${PROJECT_ID}`;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isoDateDaysAgo(days: number): string {
  return isoDaysAgo(days).slice(0, 10);
}

function money(n: number): string {
  return n.toFixed(2);
}

interface MaterialSpec {
  name: string;
  unit: string;
  received: number;
  used: number;
  unitCost: number;
  reorderThreshold?: number;
}

const MATERIALS: MaterialSpec[] = [
  { name: "Cement OPC 42.5", unit: "bag", received: 250, used: 120, unitCost: 4500, reorderThreshold: 50 },
  { name: "Sandcrete blocks 9-inch", unit: "block", received: 1500, used: 950, unitCost: 480, reorderThreshold: 400 },
  { name: "Sharp sand", unit: "tonne", received: 40, used: 18, unitCost: 12000, reorderThreshold: 10 },
  { name: "Granite chippings 3/4", unit: "tonne", received: 25, used: 4, unitCost: 22000 },
  { name: "Reinforcement steel 12mm (12m)", unit: "length", received: 200, used: 130, unitCost: 22000, reorderThreshold: 40 },
  { name: "Reinforcement steel 16mm (12m)", unit: "length", received: 120, used: 82, unitCost: 28500, reorderThreshold: 25 },
  { name: "Binding wire 16 gauge", unit: "roll", received: 20, used: 8, unitCost: 8500, reorderThreshold: 5 },
  { name: "Hardwood 2x4 (12ft)", unit: "length", received: 300, used: 220, unitCost: 3200 },
  { name: "Plywood marine 18mm", unit: "sheet", received: 40, used: 28, unitCost: 18500 },
  { name: "Roofing sheet Aluzinc 0.55mm", unit: "sheet", received: 180, used: 40, unitCost: 6500, reorderThreshold: 60 },
  { name: "PVC pipe 4-inch (6m)", unit: "length", received: 45, used: 12, unitCost: 5200 },
  { name: "Vitrified floor tile 600x600", unit: "box", received: 220, used: 45, unitCost: 9500 },
  { name: "Paint emulsion white", unit: "bucket", received: 60, used: 12, unitCost: 11500, reorderThreshold: 15 },
];

interface TransactionSpec {
  title: string;
  description: string | null;
  category: string;
  amount: number;
  daysAgo: number;
  vendor: string | null;
  reference: string | null;
}

const TRANSACTIONS: TransactionSpec[] = [
  { title: "Cement delivery — 200 bags", description: "First delivery for slab pour and ground-floor block work", category: "materials", amount: 900000, daysAgo: 18, vendor: "Julius Berger Materials Depot", reference: "MAT-INV-2026-011" },
  { title: "Reinforcement steel — 320 lengths", description: "Rebar cages for slabs and columns (12mm + 16mm)", category: "materials", amount: 6820000, daysAgo: 12, vendor: "Julius Berger Materials Depot", reference: "MAT-INV-2026-014" },
  { title: "Sandcrete blocks — 3,000 blocks", description: "Second block delivery for first-floor superstructure", category: "materials", amount: 1440000, daysAgo: 9, vendor: "Lekki Building Supplies", reference: "MAT-INV-2026-018" },
  { title: "Granite chippings — 25 tonnes", description: "3/4 aggregate for GF slab pour", category: "materials", amount: 550000, daysAgo: 32, vendor: "Kolo Aggregates", reference: "AGG-2026-071" },
  { title: "Sharp sand — 40 tonnes", description: "Bedding and mortar sand", category: "materials", amount: 480000, daysAgo: 40, vendor: "Kolo Aggregates", reference: "AGG-2026-064" },
  { title: "Site labour — week 1", description: "Weekly wages, 12 workers, 6 days", category: "labour", amount: 700000, daysAgo: 42, vendor: "Adeyemi Crew", reference: "PAY-W01" },
  { title: "Site labour — week 2", description: "Weekly wages, 14 workers, 6 days", category: "labour", amount: 820000, daysAgo: 35, vendor: "Adeyemi Crew", reference: "PAY-W02" },
  { title: "Site labour — week 3", description: "Weekly wages, 14 workers, 6 days", category: "labour", amount: 820000, daysAgo: 14, vendor: "Adeyemi Crew", reference: "PAY-W03" },
  { title: "Site labour — week 4", description: "Weekly wages, 18 workers, 6 days", category: "labour", amount: 1060000, daysAgo: 7, vendor: "Adeyemi Crew", reference: "PAY-W04" },
  { title: "Excavator hire — 3 days", description: "Bulk excavation for substructure", category: "equipment", amount: 450000, daysAgo: 22, vendor: "Heavy Plant NG", reference: "HIRE-1109" },
  { title: "Concrete pump hire — GF slab pour", description: "Boom pump, one-day hire including operator", category: "equipment", amount: 380000, daysAgo: 34, vendor: "Heavy Plant NG", reference: "HIRE-1112" },
  { title: "Scaffolding hire — month 1", description: "Perimeter scaffolding — Q3 mobilisation", category: "subcontractor", amount: 210000, daysAgo: 20, vendor: "ScaffoldPro NG", reference: "HIRE-448" },
  { title: "Formwork sub — GF slab", description: "Panel + prop supply and labour, ground-floor slab", category: "subcontractor", amount: 1250000, daysAgo: 30, vendor: "Fabrique Formworks", reference: "FF-INV-2026-19" },
  { title: "Structural engineer — site visits", description: "Weekly structural inspections during shell works", category: "professional_services", amount: 500000, daysAgo: 10, vendor: "Ove Arup & Associates", reference: "OA-INV-77" },
  { title: "Diesel — generator run", description: "150L for tower crane + site office genset", category: "utilities", amount: 195000, daysAgo: 5, vendor: "Total Depot Ikoyi", reference: "DZ-77213" },
  { title: "Water tanker — 20,000L", description: "Site water for curing and mortar", category: "utilities", amount: 65000, daysAgo: 11, vendor: "H2O Logistics", reference: "H2O-2231" },
  { title: "Site office rental — month 1", description: "Prefab office + welfare cabin", category: "preliminaries", amount: 280000, daysAgo: 60, vendor: "Portakabin Lagos", reference: "RENT-Apr" },
  { title: "Site office rental — month 2", description: "Prefab office + welfare cabin", category: "preliminaries", amount: 280000, daysAgo: 30, vendor: "Portakabin Lagos", reference: "RENT-May" },
  { title: "Site security — month 1", description: "24/7 guard service + patrol", category: "overhead", amount: 420000, daysAgo: 55, vendor: "Sentinel Security", reference: "SS-M01" },
  { title: "Site security — month 2", description: "24/7 guard service + patrol", category: "overhead", amount: 420000, daysAgo: 28, vendor: "Sentinel Security", reference: "SS-M02" },
  { title: "Building permit — annex extension", description: "Filed with Lagos State Physical Planning Permit Authority", category: "permits_fees", amount: 350000, daysAgo: 45, vendor: "LASPPPA", reference: "LSPPA/2026/1044" },
  { title: "Soil test report", description: "Geotechnical investigation & bearing capacity report", category: "professional_services", amount: 480000, daysAgo: 90, vendor: "GeoNigeria Labs", reference: "GNL-2026-11" },
  { title: "Material transport — Lekki delivery", description: "Two-truck haul from Ojota depot to site", category: "transport", amount: 85000, daysAgo: 6, vendor: "Fastway Logistics", reference: "FL-1044" },
  { title: "PPE and safety kit refill", description: "Helmets, gloves, harnesses, first-aid restock", category: "overhead", amount: 240000, daysAgo: 26, vendor: "SafeGear Nigeria", reference: "SG-8817" },
  { title: "Petty cash reimbursement", description: "Sundry site expenses (water, safety consumables)", category: "miscellaneous", amount: 45000, daysAgo: 3, vendor: null, reference: null },
];

interface CashFlowSpec {
  category: "valuation" | "milestone_payment" | "claims_payment";
  amount: number;
  isCredit: boolean;
  description: string;
  daysAgo: number;
}

const CASH_FLOW: CashFlowSpec[] = [
  { category: "milestone_payment", amount: 6000000, isCredit: false, description: "Milestone release — mobilisation & site setup certified", daysAgo: 120 },
  { category: "valuation", amount: 4200000, isCredit: false, description: "Interim valuation #1 — early substructure & site strip", daysAgo: 95 },
  { category: "valuation", amount: 8500000, isCredit: false, description: "Interim valuation #2 — substructure completed", daysAgo: 75 },
  { category: "milestone_payment", amount: 9500000, isCredit: false, description: "Milestone release — substructure & foundations signed off", daysAgo: 70 },
  { category: "claims_payment", amount: 750000, isCredit: false, description: "Approved claim — additional dewatering during May rains", daysAgo: 65 },
  { category: "valuation", amount: 6800000, isCredit: false, description: "Interim valuation #3 — columns cast, formwork struck", daysAgo: 55 },
  { category: "valuation", amount: 12200000, isCredit: false, description: "Interim valuation #4 — ground floor slab poured", daysAgo: 35 },
  { category: "milestone_payment", amount: 5800000, isCredit: false, description: "Interim release — ground floor slab at 65%", daysAgo: 28 },
  { category: "claims_payment", amount: 420000, isCredit: false, description: "Approved claim — extra rebar coupling on GF columns", daysAgo: 24 },
  { category: "valuation", amount: 5400000, isCredit: false, description: "Interim valuation #5 — first floor formwork", daysAgo: 18 },
  { category: "valuation", amount: 4900000, isCredit: false, description: "Interim valuation #6 — roofing prep", daysAgo: 8 },
  { category: "claims_payment", amount: 285000, isCredit: false, description: "Approved claim — night pour supervision (safety)", daysAgo: 6 },
  { category: "valuation", amount: 3100000, isCredit: false, description: "Interim valuation #7 (partial) — MEP first-fix mobilisation", daysAgo: 3 },
];

interface InvoiceSpec {
  number: string;
  invoiceType: "material" | "vendor" | "progress";
  vendorName: string;
  trade: string;
  status: "Draft" | "Submitted" | "Approved" | "Paid";
  daysAgoIssued: number;
  daysAgoDue: number;
  lineItems: Array<{ description: string; quantity: number; unit: string | null; unitRate: number }>;
  paidPortion?: number;
}

const INVOICES: InvoiceSpec[] = [
  {
    number: "MAT-INV-2026-011",
    invoiceType: "material",
    vendorName: "Julius Berger Materials Depot",
    trade: "Materials supply",
    status: "Approved",
    daysAgoIssued: 18,
    daysAgoDue: -12,
    lineItems: [
      { description: "Cement OPC 42.5 (bags)", quantity: 200, unit: "bag", unitRate: 4500 },
      { description: "Sandcrete blocks 9-inch", quantity: 1500, unit: "block", unitRate: 480 },
      { description: "Sharp sand", quantity: 40, unit: "tonne", unitRate: 12000 },
    ],
    paidPortion: 900000,
  },
  {
    number: "MAT-INV-2026-014",
    invoiceType: "material",
    vendorName: "Julius Berger Materials Depot",
    trade: "Reinforcement + finishes",
    status: "Submitted",
    daysAgoIssued: 12,
    daysAgoDue: -18,
    lineItems: [
      { description: "Reinforcement steel 12mm (12m)", quantity: 200, unit: "length", unitRate: 22000 },
      { description: "Reinforcement steel 16mm (12m)", quantity: 120, unit: "length", unitRate: 28500 },
      { description: "Vitrified floor tile 600x600", quantity: 220, unit: "box", unitRate: 9500 },
    ],
  },
  {
    number: "SUB-INV-2026-005",
    invoiceType: "vendor",
    vendorName: "ScaffoldPro NG",
    trade: "Scaffolding",
    status: "Approved",
    daysAgoIssued: 20,
    daysAgoDue: -10,
    lineItems: [
      { description: "Perimeter scaffolding — 3 storeys", quantity: 1, unit: "lot", unitRate: 210000 },
    ],
    paidPortion: 210000,
  },
  {
    number: "SUB-INV-2026-008",
    invoiceType: "vendor",
    vendorName: "Ove Arup & Associates",
    trade: "Structural engineering",
    status: "Approved",
    daysAgoIssued: 10,
    daysAgoDue: -20,
    lineItems: [
      { description: "Weekly structural inspections — 4 visits", quantity: 4, unit: "visit", unitRate: 125000 },
    ],
  },
  {
    number: "SUB-INV-2026-012",
    invoiceType: "vendor",
    vendorName: "Fabrique Formworks",
    trade: "Formwork subcontract",
    status: "Approved",
    daysAgoIssued: 30,
    daysAgoDue: 0,
    lineItems: [
      { description: "Formwork panels + labour — ground floor slab", quantity: 1, unit: "lot", unitRate: 1250000 },
    ],
    paidPortion: 1250000,
  },
  {
    number: "MAT-INV-2026-018",
    invoiceType: "material",
    vendorName: "Lekki Building Supplies",
    trade: "Blocks & finishes",
    status: "Approved",
    daysAgoIssued: 9,
    daysAgoDue: -21,
    lineItems: [
      { description: "Sandcrete blocks 9-inch", quantity: 3000, unit: "block", unitRate: 480 },
    ],
  },
  {
    number: "SUB-INV-2026-016",
    invoiceType: "vendor",
    vendorName: "PipesPro Nigeria",
    trade: "Plumbing supply — first fix",
    status: "Submitted",
    daysAgoIssued: 15,
    daysAgoDue: -15,
    lineItems: [
      { description: "PVC pipe 4-inch (6m)", quantity: 60, unit: "length", unitRate: 5200 },
      { description: "PVC pipe 2-inch (6m)", quantity: 45, unit: "length", unitRate: 2800 },
      { description: "PVC fittings assorted", quantity: 1, unit: "set", unitRate: 180000 },
    ],
  },
  {
    number: "PRG-INV-2026-002",
    invoiceType: "progress",
    vendorName: "Adeyemi Crew (Main contractor)",
    trade: "Progress claim",
    status: "Draft",
    daysAgoIssued: 3,
    daysAgoDue: -27,
    lineItems: [
      { description: "Interim payment application #7 — MEP first-fix mobilisation", quantity: 1, unit: "application", unitRate: 3100000 },
    ],
  },
];

interface PurchaseOrderSpec {
  number: string;
  vendorName: string;
  status: string;
  daysAgo: number;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
}

const PURCHASE_ORDERS: PurchaseOrderSpec[] = [
  { number: "PO-2026-008", vendorName: "Julius Berger Materials Depot", status: "Received", daysAgo: 42, items: [{ description: "Cement OPC 42.5 (bags)", quantity: 500, unitPrice: 4500 }, { description: "Sandcrete blocks 9-inch", quantity: 2500, unitPrice: 480 }] },
  { number: "PO-2026-013", vendorName: "Kolo Aggregates", status: "Received", daysAgo: 38, items: [{ description: "Sharp sand", quantity: 60, unitPrice: 12000 }, { description: "Granite chippings 3/4", quantity: 40, unitPrice: 22000 }] },
  { number: "PO-2026-017", vendorName: "Julius Berger Materials Depot", status: "Received", daysAgo: 30, items: [{ description: "Reinforcement steel 12mm (12m)", quantity: 200, unitPrice: 22000 }, { description: "Reinforcement steel 16mm (12m)", quantity: 120, unitPrice: 28500 }, { description: "Binding wire 16 gauge", quantity: 20, unitPrice: 8500 }] },
  { number: "PO-2026-021", vendorName: "Lekki Building Supplies", status: "Received", daysAgo: 25, items: [{ description: "Hardwood 2x4 (12ft)", quantity: 300, unitPrice: 3200 }, { description: "Plywood marine 18mm", quantity: 40, unitPrice: 18500 }] },
  { number: "PO-2026-029", vendorName: "PipesPro Nigeria", status: "PartiallyReceived", daysAgo: 15, items: [{ description: "PVC pipe 4-inch (6m)", quantity: 60, unitPrice: 5200 }, { description: "PVC pipe 2-inch (6m)", quantity: 45, unitPrice: 2800 }, { description: "PVC fittings assorted", quantity: 1, unitPrice: 180000 }] },
  { number: "PO-2026-034", vendorName: "Roofmasters Nigeria", status: "PartiallyReceived", daysAgo: 8, items: [{ description: "Roofing sheet Aluzinc 0.55mm", quantity: 200, unitPrice: 6500 }, { description: "Roofing accessories set", quantity: 1, unitPrice: 180000 }] },
  { number: "PO-2026-039", vendorName: "Ikorodu Ceramics", status: "Issued", daysAgo: 4, items: [{ description: "Vitrified floor tile 600x600", quantity: 250, unitPrice: 9500 }, { description: "Tile adhesive (25kg bags)", quantity: 30, unitPrice: 3800 }, { description: "Grout, colour matched (5kg)", quantity: 25, unitPrice: 2200 }] },
  { number: "PO-2026-041", vendorName: "PaintCo NG", status: "Issued", daysAgo: 2, items: [{ description: "Emulsion paint white 20L", quantity: 40, unitPrice: 11500 }, { description: "Emulsion paint accent — Sage", quantity: 12, unitPrice: 13800 }, { description: "Roller + brush set", quantity: 30, unitPrice: 3200 }] },
];

interface PaymentClaimSpec {
  number: string;
  amount: number;
  status: "Draft" | "Submitted" | "Approved" | "Rejected" | "Paid";
  periodStart: string;
  periodEnd: string;
  daysAgoSubmitted?: number;
  daysAgoApproved?: number;
  notes: string;
}

const PAYMENT_CLAIMS: PaymentClaimSpec[] = [
  { number: "PC-2026-001", amount: 4200000, status: "Paid", periodStart: "2026-03-15", periodEnd: "2026-03-31", daysAgoSubmitted: 95, daysAgoApproved: 92, notes: "Early substructure & site strip — interim #1" },
  { number: "PC-2026-002", amount: 8500000, status: "Paid", periodStart: "2026-04-01", periodEnd: "2026-04-30", daysAgoSubmitted: 75, daysAgoApproved: 70, notes: "Substructure completed — interim #2" },
  { number: "PC-2026-003", amount: 6800000, status: "Paid", periodStart: "2026-05-01", periodEnd: "2026-05-20", daysAgoSubmitted: 55, daysAgoApproved: 50, notes: "Columns cast, formwork struck — interim #3" },
  { number: "PC-2026-004", amount: 12200000, status: "Approved", periodStart: "2026-05-21", periodEnd: "2026-06-20", daysAgoSubmitted: 35, daysAgoApproved: 28, notes: "Ground floor slab poured — interim #4" },
  { number: "PC-2026-005", amount: 5400000, status: "Approved", periodStart: "2026-06-21", periodEnd: "2026-07-15", daysAgoSubmitted: 18, daysAgoApproved: 12, notes: "First floor formwork — interim #5" },
  { number: "PC-2026-006", amount: 4900000, status: "Submitted", periodStart: "2026-07-16", periodEnd: "2026-07-25", daysAgoSubmitted: 8, notes: "Roofing prep — interim #6" },
  { number: "PC-2026-007", amount: 3100000, status: "Draft", periodStart: "2026-07-26", periodEnd: "2026-07-29", daysAgoSubmitted: 3, notes: "MEP first-fix mobilisation — interim #7 (partial)" },
];

const SUPPLIERS = [
  { name: "Julius Berger Materials Depot", contact: "Chidi Okoro", email: "chidi@julius-berger.ng", phone: "+234 803 501 2233", address: "Ojota Industrial, Lagos" },
  { name: "Lekki Building Supplies", contact: "Uche Nnamdi", email: "sales@lekkibuild.ng", phone: "+234 807 442 8811", address: "Lekki Phase 1, Lagos" },
  { name: "Kolo Aggregates", contact: "Musa Bello", email: "orders@koloagg.ng", phone: "+234 805 118 7723", address: "Mowe-Ibafo, Ogun" },
  { name: "Roofmasters Nigeria", contact: "Segun Adeyemi", email: "info@roofmasters.ng", phone: "+234 812 337 9900", address: "Isolo, Lagos" },
  { name: "PipesPro Nigeria", contact: "Adebayo Salami", email: "sales@pipespro.ng", phone: "+234 803 448 6612", address: "Amuwo Odofin, Lagos" },
  { name: "Ikorodu Ceramics", contact: "Ngozi Eze", email: "trade@ikoroduceramics.ng", phone: "+234 806 771 2255", address: "Ikorodu, Lagos" },
  { name: "PaintCo NG", contact: "Kemi Balogun", email: "orders@paintco.ng", phone: "+234 802 118 6420", address: "Apapa, Lagos" },
  { name: "ScaffoldPro NG", contact: "Emeka Ibe", email: "hire@scaffoldpro.ng", phone: "+234 809 271 3355", address: "Ikorodu, Lagos" },
  { name: "Heavy Plant NG", contact: "Tunde Okafor", email: "dispatch@heavyplant.ng", phone: "+234 806 990 1120", address: "Sango Ota, Ogun" },
  { name: "Fabrique Formworks", contact: "Ibrahim Danjuma", email: "quotes@fabrique.ng", phone: "+234 703 995 4488", address: "Ilupeju, Lagos" },
  { name: "Adeyemi Crew (main contractor labour)", contact: "Yusuf Adeyemi", email: "yusuf@adeyemicrew.ng", phone: "+234 803 771 4409", address: "Ikeja, Lagos" },
  { name: "Sentinel Security", contact: "Ada Chukwu", email: "ops@sentinel-sec.ng", phone: "+234 810 552 7788", address: "Yaba, Lagos" },
  { name: "Ove Arup & Associates", contact: "Dr. Angela Bello", email: "abello@arup.com", phone: "+234 703 220 5544", address: "Victoria Island, Lagos" },
];

const TASKS = [
  { columnStatus: "done" as const, title: "Site handover and setup", description: "Formal handover from client, site fencing, mobilise cabin.", priority: "High" as const, labels: ["setup"], dueDaysAhead: -50 },
  { columnStatus: "done" as const, title: "Foundations concrete pour", description: "Ready-mix pour with mesh reinforcement.", priority: "High" as const, labels: ["concrete", "milestone"], dueDaysAhead: -32 },
  { columnStatus: "done" as const, title: "Ground floor block work — east wing", description: "9-inch block work up to lintel level.", priority: "Medium" as const, dueDaysAhead: -14 },
  { columnStatus: "in_progress" as const, title: "Slab shuttering — first floor", description: "Plywood + hardwood props for suspended slab.", priority: "High" as const, labels: ["formwork"], dueDaysAhead: 3 },
  { columnStatus: "in_progress" as const, title: "Rebar cage — first floor columns", description: "12mm main + 8mm stirrups tied and inspected.", priority: "High" as const, labels: ["rebar"], dueDaysAhead: 5 },
  { columnStatus: "in_progress" as const, title: "Order roofing accessories", description: "Ridge caps, valleys, drip edges.", priority: "Medium" as const, dueDaysAhead: 2 },
  { columnStatus: "todo" as const, title: "Confirm tile selections with client", description: "Master bath + guest suite — decide by Friday.", priority: "Medium" as const, labels: ["client"], dueDaysAhead: 4 },
  { columnStatus: "todo" as const, title: "Award electrical subcontract", description: "Three bids in — awaiting client sign-off.", priority: "High" as const, labels: ["subcontract"], dueDaysAhead: 7 },
  { columnStatus: "todo" as const, title: "Book structural inspection — first floor", description: "Coordinate with Arup for post-pour inspection.", priority: "Medium" as const, labels: ["inspection"], dueDaysAhead: 10 },
  { columnStatus: "todo" as const, title: "Draft roofing method statement", description: "Method + safety plan for aluzinc install.", priority: "Low" as const, dueDaysAhead: 14 },
];

const RFIS = [
  { number: 1, subject: "Column rebar detail at grid B-3", question: "16mm hoop spacing at intersection differs between the structural drawings and the BoQ. Please confirm.", status: "Answered", priority: "High", visibility: "internal", ballInCourtName: "Dr. Angela Bello", daysAgo: 12, officialResponse: "Use 100mm spacing per revised SD-04 rev C (2026-06-18). Ignore the older BoQ value.", daysAgoResponded: 8 },
  { number: 2, subject: "Waterproofing spec for master bathroom", question: "Which membrane system should we specify? Client wants a 20-year warranty.", status: "Open", priority: "Normal", visibility: "shared", ballInCourtName: "Client (Mr. Adeyi)", daysAgo: 5, officialResponse: null, daysAgoResponded: null as number | null },
  { number: 3, subject: "Overhead clearance for kitchen extractor", question: "Duct routing conflicts with structural beam at grid C-2. Options: relocate hood 300mm north, or drop ceiling.", status: "Open", priority: "Low", visibility: "internal", ballInCourtName: "Interior architect", daysAgo: 2, officialResponse: null, daysAgoResponded: null as number | null },
];

const SELECTIONS = [
  { title: "Master bathroom floor tile", description: "600×600 vitrified, matte finish preferred.", category: "Finishes", allowance: 900000, status: "decided", chosenIndex: 1 as number | null, options: [ { name: "Bianco Carrara look", price: 850000, description: "Cream white with soft grey veins" }, { name: "Nero Marquina look", price: 920000, description: "Deep black with white veining" }, { name: "Sahara sand", price: 780000, description: "Warm beige, single tone" } ] },
  { title: "Kitchen worktop material", description: "Full depth 60cm, waterfall island end.", category: "Kitchen", allowance: 1500000, status: "open", chosenIndex: null as number | null, options: [ { name: "Quartz — Calacatta Gold", price: 1650000, description: "White with warm gold veining" }, { name: "Granite — Absolute Black", price: 1350000, description: "Deep black, honed finish" }, { name: "Solid surface — Corian Rain Cloud", price: 1420000, description: "Soft grey pattern" } ] },
  { title: "Front door finish", description: "Solid hardwood, 2400 × 1000mm.", category: "Doors", allowance: 850000, status: "decided", chosenIndex: 0 as number | null, options: [ { name: "Iroko — clear varnish", price: 820000, description: "Golden tone, natural grain" }, { name: "Mahogany — dark stain", price: 890000, description: "Rich burgundy" } ] },
  { title: "Living room chandelier", description: "5m ceiling height, statement piece.", category: "Lighting", allowance: 600000, status: "open", chosenIndex: null as number | null, options: [ { name: "Modern brass cluster (12-arm)", price: 750000, description: "Aged brass, dimmable" }, { name: "Crystal cascade (3-tier)", price: 690000, description: "K9 crystal drops" }, { name: "Minimalist LED ring (900mm)", price: 480000, description: "Matte black, warm white" } ] },
];

const RISKS = [
  { title: "Weather delay — rainy season", description: "Roofing works scheduled for Aug/Sep may be pushed by heavy rains.", severity: "Medium" },
  { title: "Rebar price volatility", description: "Steel prices rose 12% in Q2. Contract lock-in at Q3 rates recommended.", severity: "High" },
  { title: "Sub-contractor availability — electrical", description: "Preferred electrical crew is booked until August. Backup identified.", severity: "Low" },
  { title: "Client selection delays", description: "Kitchen worktop still undecided. May slow cabinet install.", severity: "Medium" },
  { title: "Adjacent construction — vibration", description: "Neighbour started foundation next lot. Coordinate to protect our finishes.", severity: "Low" },
];

const FINANCE_EVENTS = [
  { type: "milestone_updated", actorName: "Angela Bello", summary: "Set contract sum to ₦120,000,000", amount: 120000000, daysAgo: 60 },
  { type: "milestone_updated", actorName: "Angela Bello", summary: "Recorded variation · +2,500,000 (Additional steel for revised roof design)", amount: 2500000, daysAgo: 22 },
  { type: "milestone_updated", actorName: "Angela Bello", summary: "Recorded variation · -500,000 (Omission of decorative cornice)", amount: -500000, daysAgo: 18 },
  { type: "milestone_released", actorName: "Adeyi Client", summary: "Released Milestone 1 · Foundations", amount: 6800000, daysAgo: 32 },
  { type: "milestone_released", actorName: "Adeyi Client", summary: "Released Milestone 2 · Structural Shell", amount: 10500000, daysAgo: 15 },
  { type: "deposit", actorName: "Adeyi Client", summary: "Funded project · ₦45,000,000", amount: 45000000, daysAgo: 55 },
];

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>();
  if (!project) return;

  await knex("project_finances")
    .where({ project_id: PROJECT_ID })
    .update({
      contract_sum: 120000000,
      variations_total: 2000000,
      certified_gross_to_date: 45100000,
      amount_paid_to_date: 19500000,
      retention_rate: 0.05,
      retention_held: 2255000,
      contract_type: "gmp",
      retention_release_mode: "staged_pc_dlp",
      advance_percentage: 0.1,
      advance_recovery_mode: "percentage",
      advance_recovery_rate: 0.1,
      advance_recovered: 1950000,
      payment_terms_days: 30,
      defects_liability_days: 365,
      contract_notes:
        "JCT SBC/Q 2016 with amendments. Retention released 50/50 at practical completion and end of defects liability period.",
    });

  await knex("cash_flow_entries").where({ project_id: PROJECT_ID }).del();
  await knex("cash_flow_entries").insert(CASH_FLOW.map((entry, idx) => ({
    id: `cfe_${randomUUID()}`,
    project_id: PROJECT_ID,
    category: entry.category,
    amount: money(entry.amount),
    is_credit: entry.isCredit,
    description: entry.description,
    entry_date: isoDateDaysAgo(entry.daysAgo),
    created_by_id: null,
    created_by_name: "Demo",
    sort_order: idx,
    retention_accrued: entry.category === "valuation" ? money(entry.amount * 0.05) : "0",
    created_at: knex.fn.now(),
  })));

  await knex("material_ledger_entries").where({ project_id: PROJECT_ID }).del();
  await knex("materials_stock").where({ project_id: PROJECT_ID }).del();
  await knex("materials_catalog").where({ project_id: PROJECT_ID }).del();

  for (const material of MATERIALS) {
    const catalogId = `mcat_${randomUUID()}`;
    await knex("materials_catalog").insert({
      id: catalogId,
      project_id: PROJECT_ID,
      name: material.name,
      normalized_name: material.name.trim().toLowerCase(),
      unit: material.unit,
      active: true,
      low_stock_threshold: material.reorderThreshold ?? null,
      reorder_quantity: null,
      lead_time_days: null,
      preferred_supplier_id: null,
      auto_reorder_enabled: false,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });

    const onHand = material.received - material.used;
    await knex("materials_stock").insert({
      project_id: PROJECT_ID,
      material_id: catalogId,
      location_key: "default",
      on_hand_qty: money(onHand),
      last_ledger_entry_id: null,
      updated_at: knex.fn.now(),
    });

    await knex("material_ledger_entries").insert({
      id: `mle_${randomUUID()}`,
      project_id: PROJECT_ID,
      idempotency_key: `demo-in-${catalogId}`,
      entry_type: "IN",
      status: "Posted",
      material_id: catalogId,
      material_name_snapshot: material.name,
      unit_snapshot: material.unit,
      location_key: "default",
      quantity: money(material.received),
      stock_delta: money(material.received),
      occurred_at: isoDaysAgo(15),
      timestamp_suspect: false,
      negative_stock: false,
      logged_by_id: null,
      material_order_id: null,
      task_id: null,
      activity_id: null,
      reversal_for_entry_id: null,
      reason: `Initial delivery — ${material.name}`,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
      notes_html: null,
    });

    if (material.used > 0) {
      await knex("material_ledger_entries").insert({
        id: `mle_${randomUUID()}`,
        project_id: PROJECT_ID,
        idempotency_key: `demo-used-${catalogId}`,
        entry_type: "USED",
        status: "Posted",
        material_id: catalogId,
        material_name_snapshot: material.name,
        unit_snapshot: material.unit,
        location_key: "default",
        quantity: money(material.used),
        stock_delta: money(-material.used),
        occurred_at: isoDaysAgo(6),
        timestamp_suspect: false,
        negative_stock: false,
        logged_by_id: null,
        material_order_id: null,
        task_id: null,
        activity_id: null,
        reversal_for_entry_id: null,
        reason: `Consumed on site — ${material.name}`,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
        notes_html: null,
      });
    }
  }

  await knex("project_transactions").where({ project_id: PROJECT_ID }).del();
  await knex("project_transactions").insert(TRANSACTIONS.map((tx) => ({
    id: `txn_${randomUUID()}`,
    project_id: PROJECT_ID,
    title: tx.title,
    description: tx.description,
    category: tx.category,
    category_type: "preset",
    amount: money(tx.amount),
    transacted_at: isoDateDaysAgo(tx.daysAgo),
    vendor: tx.vendor,
    reference: tx.reference,
    receipt_file_id: null,
    created_by_id: null,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  })));

  const existingInvoiceIds = knex("project_invoices").select("id").where({ project_id: PROJECT_ID });
  await knex("invoice_budget_allocations").whereIn("invoice_id", existingInvoiceIds).del();
  await knex("invoice_payments").whereIn("invoice_id", existingInvoiceIds).del();
  await knex("project_invoice_line_items").whereIn("invoice_id", existingInvoiceIds).del();
  await knex("project_invoices").where({ project_id: PROJECT_ID }).del();

  for (const invoice of INVOICES) {
    const invoiceId = `inv_${randomUUID()}`;
    const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.quantity * item.unitRate, 0);
    const vatRate = 0.075;
    const whtRate = 0.05;
    const retentionRate = 0.05;
    const vatAmount = Math.round(subtotal * vatRate);
    const whtAmount = Math.round(subtotal * whtRate);
    const retentionAmount = Math.round(subtotal * retentionRate);
    const totalInvoiced = subtotal + vatAmount;
    const netPayable = totalInvoiced - whtAmount - retentionAmount;

    await knex("project_invoices").insert({
      id: invoiceId,
      project_id: PROJECT_ID,
      vendor_name: invoice.vendorName,
      trade: invoice.trade,
      number: invoice.number,
      status: invoice.status,
      amount: money(subtotal),
      retainage_percentage: "5",
      issue_date: isoDateDaysAgo(invoice.daysAgoIssued),
      due_date: isoDateDaysAgo(invoice.daysAgoDue),
      notes: null,
      created_at: knex.fn.now(),
      invoice_type: invoice.invoiceType,
      currency: "NGN",
      vat_rate: "7.5",
      wht_rate: "5",
      retention_rate: "5",
      subtotal: money(subtotal),
      vat_amount: money(vatAmount),
      wht_amount: money(whtAmount),
      retention_amount: money(retentionAmount),
      total_invoiced: money(totalInvoiced),
      net_payable: money(netPayable),
      cc_emails: JSON.stringify([]),
      bcc_emails: JSON.stringify([]),
    });

    await knex("project_invoice_line_items").insert(invoice.lineItems.map((item, idx) => ({
      id: `invl_${randomUUID()}`,
      invoice_id: invoiceId,
      position: idx,
      description: item.description,
      quantity: money(item.quantity),
      unit: item.unit,
      unit_rate: money(item.unitRate),
      amount: money(item.quantity * item.unitRate),
      budget_category_id: null,
      is_variation: false,
      created_at: knex.fn.now(),
    })));

    if (invoice.paidPortion) {
      await knex("invoice_payments").insert({
        id: `pay_${randomUUID()}`,
        invoice_id: invoiceId,
        amount: money(invoice.paidPortion),
        method: "Bank Transfer",
        paid_at: isoDateDaysAgo(invoice.daysAgoIssued - 5),
        note: `Partial payment towards ${invoice.number}`,
        created_at: knex.fn.now(),
      });
    }
  }

  const existingPoIds = knex("purchase_orders").select("id").where({ project_id: PROJECT_ID });
  await knex("purchase_order_items").whereIn("purchase_order_id", existingPoIds).del();
  await knex("purchase_orders").where({ project_id: PROJECT_ID }).del();

  for (const po of PURCHASE_ORDERS) {
    const poId = `po_${randomUUID()}`;
    await knex("purchase_orders").insert({
      id: poId,
      project_id: PROJECT_ID,
      po_number: po.number,
      vendor_name: po.vendorName,
      status: po.status,
      order_date: isoDateDaysAgo(po.daysAgo),
      expected_date: isoDateDaysAgo(po.daysAgo - 14),
      notes: null,
      created_at: knex.fn.now(),
    });
    await knex("purchase_order_items").insert(po.items.map((item) => ({
      id: `poi_${randomUUID()}`,
      purchase_order_id: poId,
      description: item.description,
      quantity: money(item.quantity),
      unit_price: money(item.unitPrice),
      created_at: knex.fn.now(),
    })));
  }

  await knex("payment_claims").where({ project_id: PROJECT_ID }).del();
  await knex("payment_claims").insert(PAYMENT_CLAIMS.map((claim) => ({
    id: `pc_${randomUUID()}`,
    project_id: PROJECT_ID,
    milestone_payment_id: null,
    claim_number: claim.number,
    period_start: claim.periodStart,
    period_end: claim.periodEnd,
    amount: money(claim.amount),
    status: claim.status,
    submitted_at: claim.daysAgoSubmitted !== undefined ? isoDaysAgo(claim.daysAgoSubmitted) : null,
    approved_at: claim.daysAgoApproved !== undefined ? isoDaysAgo(claim.daysAgoApproved) : null,
    notes: claim.notes,
    created_at: knex.fn.now(),
  })));

  await knex("suppliers").where({ project_id: PROJECT_ID }).del();
  await knex("suppliers").insert(SUPPLIERS.map((supplier) => ({
    id: `sup_${randomUUID()}`,
    project_id: PROJECT_ID,
    name: supplier.name,
    contact_name: supplier.contact,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    notes: null,
    active: true,
    created_by_id: null,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  })));

  const existingTaskIds = knex("tasks").select("id").where({ project_id: PROJECT_ID });
  const existingBoardIds = knex("task_boards").select("id").where({ project_id: PROJECT_ID });
  await knex("task_comments").whereIn("task_id", existingTaskIds).del();
  await knex("task_assignees").whereIn("task_id", existingTaskIds).del();
  await knex("tasks").where({ project_id: PROJECT_ID }).del();
  await knex("task_columns").whereIn("board_id", existingBoardIds).del();
  await knex("task_boards").where({ project_id: PROJECT_ID }).del();

  const boardId = `tb_${randomUUID()}`;
  await knex("task_boards").insert({
    id: boardId,
    project_id: PROJECT_ID,
    building_id: BUILDING_ID,
    name: "Site tasks",
    is_default: true,
    created_by_id: null,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  });

  const columns = [
    { id: `tc_${randomUUID()}`, name: "To do", status: "todo", position: 0 },
    { id: `tc_${randomUUID()}`, name: "In progress", status: "in_progress", position: 1 },
    { id: `tc_${randomUUID()}`, name: "Done", status: "done", position: 2 },
  ];
  await knex("task_columns").insert(columns.map((c) => ({
    id: c.id,
    board_id: boardId,
    name: c.name,
    status: c.status,
    position: c.position,
    created_at: knex.fn.now(),
  })));

  const columnsByStatus = new Map(columns.map((c) => [c.status, c.id]));
  let taskPos = 0;
  for (const task of TASKS) {
    await knex("tasks").insert({
      id: `tsk_${randomUUID()}`,
      project_id: PROJECT_ID,
      building_id: BUILDING_ID,
      board_id: boardId,
      column_id: columnsByStatus.get(task.columnStatus)!,
      title: task.title,
      description: task.description,
      assignee_id: null,
      due_date: task.dueDaysAhead !== undefined ? isoDateDaysAgo(-task.dueDaysAhead) : null,
      position: taskPos++,
      source_type: null,
      source_id: null,
      created_by_id: null,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
      assignee_team_member_id: null,
      description_html: null,
      priority: task.priority,
      labels: JSON.stringify(task.labels ?? []),
    });
  }

  const existingRfiIds = knex("rfis").select("id").where({ project_id: PROJECT_ID });
  await knex("rfi_comments").whereIn("rfi_id", existingRfiIds).del();
  await knex("rfis").where({ project_id: PROJECT_ID }).del();
  for (const rfi of RFIS) {
    await knex("rfis").insert({
      id: `rfi_${randomUUID()}`,
      project_id: PROJECT_ID,
      number: rfi.number,
      subject: rfi.subject,
      question: rfi.question,
      status: rfi.status,
      priority: rfi.priority,
      visibility: rfi.visibility,
      ball_in_court_id: null,
      ball_in_court_name: rfi.ballInCourtName,
      ball_in_court_email: null,
      assignee_role: null,
      due_date: null,
      official_response: rfi.officialResponse,
      official_responded_by_id: null,
      official_responded_at: rfi.daysAgoResponded !== null && rfi.daysAgoResponded !== undefined ? isoDaysAgo(rfi.daysAgoResponded) : null,
      cost_impact: 0,
      schedule_impact: 0,
      change_request_id: null,
      reopened_count: 0,
      created_by_id: null,
      last_reminded_on: null,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }

  const existingSelectionIds = knex("project_selections").select("id").where({ project_id: PROJECT_ID });
  await knex("project_selection_options").whereIn("selection_id", existingSelectionIds).del();
  await knex("project_selections").where({ project_id: PROJECT_ID }).del();
  for (const selection of SELECTIONS) {
    const selectionId = `sel_${randomUUID()}`;
    const optionIds = selection.options.map(() => `selopt_${randomUUID()}`);
    await knex("project_selections").insert({
      id: selectionId,
      project_id: PROJECT_ID,
      title: selection.title,
      description: selection.description,
      category: selection.category,
      allowance_amount: money(selection.allowance),
      currency: "NGN",
      due_date: null,
      status: selection.status,
      chosen_option_id: null,
      decided_by_id: null,
      decided_at: null,
      change_request_id: null,
      created_by_id: null,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
      reminder_level: null,
      last_reminded_at: null,
    });
    await knex("project_selection_options").insert(selection.options.map((opt, idx) => ({
      id: optionIds[idx]!,
      selection_id: selectionId,
      name: opt.name,
      description: opt.description,
      price: opt.price !== null ? money(opt.price) : null,
      sort_order: idx,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })));
    if (selection.chosenIndex !== null) {
      await knex("project_selections")
        .where({ id: selectionId })
        .update({
          chosen_option_id: optionIds[selection.chosenIndex]!,
          decided_at: isoDaysAgo(4),
        });
    }
  }

  await knex("risk_factors").where({ project_id: PROJECT_ID }).del();
  await knex("risk_factors").insert(RISKS.map((risk) => ({
    id: `rf_${randomUUID()}`,
    project_id: PROJECT_ID,
    title: risk.title,
    description: risk.description,
    severity: risk.severity,
    created_at: knex.fn.now(),
  })));

  await knex("finance_events").where({ project_id: PROJECT_ID }).del();
  await knex("finance_events").insert(FINANCE_EVENTS.map((event) => ({
    id: `fev_${randomUUID()}`,
    project_id: PROJECT_ID,
    type: event.type,
    actor_id: null,
    actor_name: event.actorName,
    summary: event.summary,
    amount: event.amount !== null ? money(event.amount) : null,
    entity_id: null,
    created_at: isoDaysAgo(event.daysAgo),
  })));

  await knex("project_participants").where({ project_id: PROJECT_ID }).del();
  await knex("project_participants").insert([
    { id: `pp_${randomUUID()}`, project_id: PROJECT_ID, user_id: null, email: "adeyi.client@buildpanda.demo", role: "client", status: "active", invited_by_id: null, invite_token: null, invite_expires_at: null, created_at: knex.fn.now(), updated_at: knex.fn.now(), name: "Adeyi Client (Homeowner)", permissions: JSON.stringify({}) },
    { id: `pp_${randomUUID()}`, project_id: PROJECT_ID, user_id: null, email: "angela.bello@arup.com", role: "consultant", status: "active", invited_by_id: null, invite_token: null, invite_expires_at: null, created_at: knex.fn.now(), updated_at: knex.fn.now(), name: "Angela Bello (Structural)", permissions: JSON.stringify({}) },
  ]);
}
