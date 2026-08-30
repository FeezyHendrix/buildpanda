import type { ProjectDocument } from "@/lib/project-types";
import { documentVersionViewUrl } from "@/hooks/use-documents";

export type SheetKind = "image" | "pdf" | "other";

export interface Sheet {
  id: string;
  code: string;
  title: string;
  revision: string;
  scale: string | null;
  kind: SheetKind;
  src: string | null;
  alt: string;
}

export interface Pt {
  x: number;
  y: number;
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ── Measurement ────────────────────────────────────────────────────────────
// Sheet coordinates are percentages. For scaled mock sheets we assume an
// Arch D sheet (36" wide) so % → drawing inches → real feet via the scale
// ratio (1/4" = 1'-0" means 1 drawing inch = 48 real inches). Real uploads
// carry no calibrated scale, so distances fall back to % of sheet width.
const SHEET_WIDTH_IN = 36;

function scaleFactor(scale: string | null): number | null {
  if (!scale) return null;
  const match = scale.match(/1\/(\d+)"\s*=\s*1'/);
  if (!match) return null;
  const denom = Number(match[1]);
  return Number.isFinite(denom) && denom > 0 ? denom * 12 : null;
}

export function measureLabel(a: Pt, b: Pt, scale: string | null, aspect: number, customFtPerPct?: number): string {
  const dxPct = b.x - a.x;
  const dyPct = (b.y - a.y) * aspect;
  const distPct = Math.hypot(dxPct, dyPct);

  if (customFtPerPct) {
    return formatFeetInches(distPct * customFtPerPct);
  }

  const factor = scaleFactor(scale);
  if (factor === null) return `${distPct.toFixed(1)}% of sheet`;
  const realInches = (distPct / 100) * SHEET_WIDTH_IN * factor;
  return formatFeetInches(realInches / 12);
}

function formatFeetInches(decimalFeet: number): string {
  const totalInches = Math.round(decimalFeet * 12);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return inches === 12 ? `${feet + 1}'-0"` : `${feet}'-${inches}"`;
}

// ── Mock sheets (inline SVG data URIs, used outside a project context) ─────

const PLAN_LAYOUTS: [number, number, number, number][][] = [
  [[60, 60, 300, 200], [380, 60, 360, 140], [380, 220, 200, 180], [600, 220, 140, 180], [60, 280, 300, 200], [380, 420, 360, 60]],
  [[60, 60, 220, 300], [300, 60, 440, 120], [300, 200, 210, 160], [530, 200, 210, 160], [60, 380, 450, 100], [530, 380, 210, 100]],
  [[60, 60, 340, 160], [420, 60, 320, 160], [60, 240, 200, 240], [280, 240, 240, 120], [280, 380, 240, 100], [540, 240, 200, 240]],
  [[60, 60, 680, 100], [60, 180, 250, 300], [330, 180, 190, 140], [540, 180, 200, 140], [330, 340, 410, 140], [60, 500, 0, 0]],
];

function planImage(index: number, sheet: { code: string; title: string }, accent: string): string {
  const rooms = (PLAN_LAYOUTS[index % PLAN_LAYOUTS.length] ?? [])
    .filter(([, , w, h]) => w > 0 && h > 0)
    .map(
      ([x, y, w, h], i) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#334155" stroke-width="3"/>` +
        `<text x="${x + 12}" y="${y + 26}" font-family="monospace" font-size="15" fill="#64748b">RM ${index + 1}0${i + 1}</text>`,
    )
    .join("");
  const grid = Array.from({ length: 7 }, (_, i) => {
    const gx = 100 + i * 100;
    return `<line x1="${gx}" y1="30" x2="${gx}" y2="560" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 8"/><circle cx="${gx}" cy="24" r="11" fill="none" stroke="#94a3b8" stroke-width="1.5"/><text x="${gx}" y="28" text-anchor="middle" font-family="monospace" font-size="11" fill="#64748b">${i + 1}</text>`;
  }).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 620">` +
    `<rect width="800" height="620" fill="#fdfdfa"/>${grid}` +
    `<rect x="48" y="48" width="704" height="464" fill="none" stroke="#0f172a" stroke-width="7"/>${rooms}` +
    `<path d="M ${120 + index * 60} 512 a 44 44 0 0 1 44 -44" fill="none" stroke="${accent}" stroke-width="2.5"/>` +
    `<line x1="60" y1="540" x2="740" y2="540" stroke="${accent}" stroke-width="2"/>` +
    `<text x="60" y="562" font-family="monospace" font-size="14" fill="#475569">${sheet.title.toUpperCase()}</text>` +
    `<rect x="560" y="548" width="192" height="60" fill="none" stroke="#334155" stroke-width="2"/>` +
    `<text x="572" y="572" font-family="monospace" font-size="17" font-weight="bold" fill="#0f172a">${sheet.code}</text>` +
    `<text x="572" y="594" font-family="monospace" font-size="11" fill="${accent}">BUILDPANDA REVIEW SET</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const MOCK_META = [
  { code: "A-114", title: "Second Floor Framing Plan", revision: "Rev C", scale: '1/4" = 1\'-0"', accent: "#b91c1c" },
  { code: "A-104", title: "First Floor Plan", revision: "Rev B", scale: '1/4" = 1\'-0"', accent: "#004DE7" },
  { code: "A-112", title: "Second Floor Plan", revision: "Rev C", scale: '1/4" = 1\'-0"', accent: "#15803d" },
  { code: "A-201", title: "Building Elevations", revision: "Rev A", scale: '1/8" = 1\'-0"', accent: "#b45309" },
] as const;

export const MOCK_SHEETS: Sheet[] = MOCK_META.map((meta, index) => ({
  id: meta.code,
  code: meta.code,
  title: meta.title,
  revision: meta.revision,
  scale: meta.scale,
  kind: "image",
  src: planImage(index, meta, meta.accent),
  alt: `Architectural floor plan, sheet ${meta.code}, ${meta.revision}, ${meta.title.toLowerCase()}`,
}));

// ── Real project plans → sheets ────────────────────────────────────────────

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]);

function sheetKind(fileName: string): SheetKind {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export function adaptPlanDocuments(documents: ProjectDocument[], projectId: string): Sheet[] {
  return documents
    .filter((d) => d.group === "plan")
    .map((doc, index) => ({
      id: doc.id,
      code: `P-${String(index + 1).padStart(2, "0")}`,
      title: doc.fileName,
      revision: doc.versionNo > 0 ? `v${doc.versionNo}` : "v1",
      scale: null,
      kind: sheetKind(doc.fileName),
      src: doc.currentVersionId ? documentVersionViewUrl(projectId, doc.id, doc.currentVersionId) : null,
      alt: `Plan sheet ${doc.fileName}, ${doc.category}`,
    }));
}
