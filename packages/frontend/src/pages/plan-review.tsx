/*
 * Drawing Review Workspace — client-side prototype (no backend).
 * Production expansion points, intentionally out of scope here:
 * - Persist comments, pins and markup (documents module / API)
 * - Store walkthrough recordings with real audio + screen capture
 * - Real identity (session user) instead of the hardcoded "You" author
 * - Live collaboration / presence on the same sheet
 * - Revision data served from the backend per sheet
 * - Permissions and audit trail for review actions
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Columns2,
  Eye,
  EyeOff,
  FileText,
  Hand,
  Layers,
  Lock,
  MapPin,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Pen,
  Play,
  Plus,
  RotateCcw,
  Ruler,
  Search,
  Send,
  Square,
  Star,
  Trash2,
  Unlock,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Data model ─────────────────────────────────────────────────────────────

type Tool = "pan" | "select" | "measure" | "pen" | "cloud" | "comment";
type BlendMode = "differences" | "ghost" | "highlight";
type PopoverId =
  | "search"
  | "revision"
  | "reviewTools"
  | "color"
  | "paneOptsPrimary"
  | "paneOptsCompare";

interface Sheet {
  id: string;
  title: string;
  revision: string;
  scale: string;
  image: string;
  alt: string;
}

interface Pin {
  id: string;
  sheetId: string;
  x: number;
  y: number;
  color: string;
  noteId: string | null;
}

interface Note {
  id: string;
  type: "comment" | "recording";
  text: string;
  author: string;
  createdAt: number;
  sheetId: string;
  pinId: string | null;
  durationSeconds: number | null;
}

interface TracePoint {
  x: number;
  y: number;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ── Mock plan images (inline SVG data URIs, no network) ────────────────────

const PLAN_LAYOUTS: [number, number, number, number][][] = [
  [[60, 60, 300, 200], [380, 60, 360, 140], [380, 220, 200, 180], [600, 220, 140, 180], [60, 280, 300, 200], [380, 420, 360, 60]],
  [[60, 60, 220, 300], [300, 60, 440, 120], [300, 200, 210, 160], [530, 200, 210, 160], [60, 380, 450, 100], [530, 380, 210, 100]],
  [[60, 60, 340, 160], [420, 60, 320, 160], [60, 240, 200, 240], [280, 240, 240, 120], [280, 380, 240, 100], [540, 240, 200, 240]],
  [[60, 60, 680, 100], [60, 180, 250, 300], [330, 180, 190, 140], [540, 180, 200, 140], [330, 340, 410, 140], [60, 500, 0, 0]],
];

function planImage(index: number, sheet: { id: string; title: string }, accent: string): string {
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
    `<text x="572" y="572" font-family="monospace" font-size="17" font-weight="bold" fill="#0f172a">${sheet.id}</text>` +
    `<text x="572" y="594" font-family="monospace" font-size="11" fill="${accent}">BUILDPANDA REVIEW SET</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const SHEET_META = [
  { id: "A-114", title: "Second Floor Framing Plan", revision: "Rev C", scale: '1/4" = 1\'-0"', accent: "#b91c1c" },
  { id: "A-104", title: "First Floor Plan", revision: "Rev B", scale: '1/4" = 1\'-0"', accent: "#004DE7" },
  { id: "A-112", title: "Second Floor Plan", revision: "Rev C", scale: '1/4" = 1\'-0"', accent: "#15803d" },
  { id: "A-201", title: "Building Elevations", revision: "Rev A", scale: '1/8" = 1\'-0"', accent: "#b45309" },
] as const;

const SHEETS: Sheet[] = SHEET_META.map((meta, index) => ({
  id: meta.id,
  title: meta.title,
  revision: meta.revision,
  scale: meta.scale,
  image: planImage(index, meta, meta.accent),
  alt: `Architectural floor plan, sheet ${meta.id}, ${meta.revision}, ${meta.title.toLowerCase()}`,
}));

const TOOLS: { id: Tool; label: string; shortcut: string; Icon: typeof Hand }[] = [
  { id: "pan", label: "Pan", shortcut: "H", Icon: Hand },
  { id: "select", label: "Select", shortcut: "V", Icon: MousePointer2 },
  { id: "measure", label: "Measure", shortcut: "M", Icon: Ruler },
  { id: "pen", label: "Pen", shortcut: "P", Icon: Pen },
  { id: "cloud", label: "Cloud", shortcut: "C", Icon: Cloud },
  { id: "comment", label: "Comment", shortcut: "N", Icon: MessageSquarePlus },
];

const MARKUP_COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#004DE7", label: "Blue" },
  { value: "#111827", label: "Black" },
];

const REVISIONS = ["Rev A", "Rev B", "Rev C"];

function sheetAt(index: number): Sheet {
  const found = SHEETS[clamp(index, 0, SHEETS.length - 1)];
  if (!found) throw new Error("sheet index out of range");
  return found;
}

const BLEND_MODES: { id: BlendMode; label: string }[] = [
  { id: "differences", label: "Differences" },
  { id: "ghost", label: "Ghost" },
  { id: "highlight", label: "Highlight" },
];
const PLAYBACK_SECONDS = 4;

// ── Small shared pieces ────────────────────────────────────────────────────

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "rounded border border-[#E2E2E2] bg-[#F6F6F6] px-1.5 py-0.5 font-mono text-[10px] leading-none text-gray-500",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

function IconBtn({
  label,
  onClick,
  active,
  pressed,
  disabled,
  expanded,
  hasPopup,
  className,
  children,
  ...rest
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  hasPopup?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled" | "className" | "children">) {
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-haspopup={hasPopup ? "true" : undefined}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 outline-none transition-colors",
        "hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900/10",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-primary-600 text-white ring-1 ring-primary-200 hover:bg-primary-600 hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

function PopShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      data-popover-root
      className={cn(
        "absolute z-50 mt-2 rounded-xl bg-white p-2 text-sm text-gray-700 shadow-lg ring-1 ring-black/5",
        className,
      )}
    >
      {children}
    </div>
  );
}

const POP_ITEM_CLS =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-gray-700 hover:bg-[#F6F6F6]";

// ── Split view pane ────────────────────────────────────────────────────────

function SheetPane({
  paneKey,
  label,
  sheetIndex,
  zoom,
  locked,
  optionsOpen,
  onToggleOptions,
  onSheetChange,
  onZoomChange,
  onFit,
}: {
  paneKey: string;
  label: string;
  sheetIndex: number;
  zoom: number;
  locked: boolean;
  optionsOpen: boolean;
  onToggleOptions: () => void;
  onSheetChange: (index: number) => void;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
}) {
  const sheet = sheetAt(sheetIndex);
  const selectId = `${paneKey}-sheet-select`;
  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#EDEDED] bg-white">
      <div className="flex items-center gap-2 border-b border-[#F0F0F0] px-3 py-2">
        <span className="rounded bg-[#F6F6F6] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
          {label}
        </span>
        <label htmlFor={selectId} className="sr-only">
          {label} pane sheet
        </label>
        <select
          id={selectId}
          value={sheetIndex}
          disabled={locked}
          onChange={(e) => onSheetChange(Number(e.target.value))}
          className="h-7 min-w-0 rounded-md bg-[#F6F6F6] px-2 text-xs font-medium text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {SHEETS.map((s, i) => (
            <option key={s.id} value={i}>
              {s.id} · {s.title}
            </option>
          ))}
        </select>
        <IconBtn
          label={`${label} pane: previous sheet`}
          disabled={locked || sheetIndex === 0}
          onClick={() => onSheetChange(sheetIndex - 1)}
          className="size-7"
        >
          <ChevronLeft size={14} />
        </IconBtn>
        <IconBtn
          label={`${label} pane: next sheet`}
          disabled={locked || sheetIndex === SHEETS.length - 1}
          onClick={() => onSheetChange(sheetIndex + 1)}
          className="size-7"
        >
          <ChevronRight size={14} />
        </IconBtn>
        <span className="ml-auto text-[11px] text-gray-500">{sheet.revision}</span>
        <div className="relative">
          <IconBtn
            label={`${label} pane options`}
            onClick={onToggleOptions}
            expanded={optionsOpen}
            hasPopup
            className="size-7"
            data-popover-trigger
          >
            <MoreHorizontal size={14} />
          </IconBtn>
          {optionsOpen && (
            <PopShell className="right-0 w-44">
              <button type="button" onClick={onFit} className={POP_ITEM_CLS}>
                <Maximize2 size={14} /> Fit to pane
              </button>
              <button
                type="button"
                disabled
                title="Rotate (coming soon)"
                className={cn(POP_ITEM_CLS, "opacity-40 hover:bg-transparent")}
              >
                <RotateCcw size={14} /> Rotate
              </button>
            </PopShell>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-[#F0F0F0] p-4">
        <div className="mx-auto w-fit min-w-full">
          <img
            src={sheet.image}
            alt={sheet.alt}
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
            className="mx-auto w-full max-w-3xl rounded border border-[#E2E2E2] bg-white shadow-md"
          />
        </div>
        {locked && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-end bg-white/50 p-3">
            <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
              <Lock size={11} /> Locked
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-[#F0F0F0] px-3 py-1.5">
        <IconBtn
          label={`${label} pane: zoom out`}
          disabled={locked || zoom <= 50}
          onClick={() => onZoomChange(zoom - 10)}
          className="size-7"
        >
          <Minus size={13} />
        </IconBtn>
        <span className="w-11 text-center font-mono text-[11px] text-gray-600">{zoom}%</span>
        <IconBtn
          label={`${label} pane: zoom in`}
          disabled={locked || zoom >= 200}
          onClick={() => onZoomChange(zoom + 10)}
          className="size-7"
        >
          <Plus size={13} />
        </IconBtn>
      </div>
    </section>
  );
}

// ── Main workspace ─────────────────────────────────────────────────────────

export default function DrawingReviewWorkspace() {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [sheetRevisions, setSheetRevisions] = useState<Record<string, string>>(() =>
    Object.fromEntries(SHEETS.map((s) => [s.id, s.revision])),
  );
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [markupColor, setMarkupColor] = useState("#ef4444");
  const [markupVisible, setMarkupVisible] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  const [openPopover, setOpenPopover] = useState<PopoverId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [blendPanelOpen, setBlendPanelOpen] = useState(false);
  const [blendMode, setBlendMode] = useState<BlendMode | null>(null);
  const [blendAmount, setBlendAmount] = useState(50);
  const [compareSheetIndex, setCompareSheetIndex] = useState(1);

  const [split, setSplit] = useState({
    open: false,
    primaryIndex: 0,
    compareIndex: 1,
    primaryZoom: 100,
    compareZoom: 100,
    locked: false,
    synced: false,
    dividerRatio: 0.5,
  });

  const [pins, setPins] = useState<Pin[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [pendingPinId, setPendingPinId] = useState<string | null>(null);
  const [notesPanelOpen, setNotesPanelOpen] = useState(true);

  const [recStatus, setRecStatus] = useState<"idle" | "recording" | "saved">("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [playProgress, setPlayProgress] = useState<number | null>(null);

  const drawingRef = useRef<HTMLDivElement>(null);
  const splitStageRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastTraceAt = useRef(0);
  const playTimer = useRef<number | null>(null);

  const sheet = sheetAt(activeSheetIndex);
  const compareSheet = sheetAt(compareSheetIndex);
  const currentRevision = sheetRevisions[sheet.id] ?? sheet.revision;
  const sheetPins = pins.filter((p) => p.sheetId === sheet.id);
  const commentCount = notes.filter((n) => n.type === "comment").length;
  const recordingCount = notes.filter((n) => n.type === "recording").length;
  const orderedNotes = useMemo(() => [...notes].sort((a, b) => b.createdAt - a.createdAt), [notes]);

  // ── Popovers: outside click + escape ──
  useEffect(() => {
    if (!openPopover) return;
    function onDown(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-popover-root]") && !target.closest("[data-popover-trigger]")) {
        setOpenPopover(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openPopover]);

  // ── Keyboard shortcuts (guarded against inputs and IME) ──
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setOpenPopover(null);
        return;
      }
      const target = e.target as HTMLElement;
      if (
        e.isComposing ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setOpenPopover("search");
        return;
      }
      const tool = TOOLS.find((t) => t.shortcut.toLowerCase() === e.key.toLowerCase());
      if (tool) {
        setActiveTool(tool.id);
        return;
      }
      if (!split.open && e.key === "ArrowLeft") setActiveSheetIndex((i) => Math.max(0, i - 1));
      if (!split.open && e.key === "ArrowRight") {
        setActiveSheetIndex((i) => Math.min(SHEETS.length - 1, i + 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [split.open]);

  useEffect(() => {
    if (openPopover === "search") searchRef.current?.focus();
    else if (searchQuery) setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPopover]);

  // ── Recording timer ──
  useEffect(() => {
    if (recStatus !== "recording") return;
    const id = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recStatus]);

  useEffect(() => {
    return () => {
      if (playTimer.current !== null) window.clearInterval(playTimer.current);
    };
  }, []);

  // ── Pins / comments ──
  function finalizePendingPin(): void {
    if (!pendingPinId) return;
    const pin = pins.find((p) => p.id === pendingPinId);
    setPendingPinId(null);
    if (!pin || pin.noteId) return;
    const noteId = generateId("note");
    setNotes((n) => [
      ...n,
      {
        id: noteId,
        type: "comment",
        text: "Pinned comment",
        author: "You",
        createdAt: Date.now(),
        sheetId: pin.sheetId,
        pinId: pin.id,
        durationSeconds: null,
      },
    ]);
    setPins((current) => current.map((p) => (p.id === pin.id ? { ...p, noteId } : p)));
  }

  function handleDrawingClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (activeTool !== "comment") return;
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return;
    finalizePendingPin();
    const pin: Pin = {
      id: generateId("pin"),
      sheetId: sheet.id,
      x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100),
      color: markupColor,
      noteId: null,
    };
    setPins((p) => [...p, pin]);
    setPendingPinId(pin.id);
    composerRef.current?.focus();
  }

  function submitComment(): void {
    const text = noteDraft.trim();
    if (!text) return;
    const pinId = pendingPinId;
    const noteId = generateId("note");
    setNotes((n) => [
      ...n,
      {
        id: noteId,
        type: "comment",
        text,
        author: "You",
        createdAt: Date.now(),
        sheetId: sheet.id,
        pinId,
        durationSeconds: null,
      },
    ]);
    if (pinId) {
      setPins((p) => p.map((pin) => (pin.id === pinId ? { ...pin, noteId } : pin)));
      setPendingPinId(null);
    }
    setNoteDraft("");
  }

  // ── Recording ──
  function startRecording(): void {
    setNotes((n) => n.filter((note) => note.type !== "recording"));
    setPlayProgress(null);
    setTrace([]);
    setRecSeconds(0);
    setRecStatus("recording");
    setOpenPopover(null);
  }

  function stopRecording(): void {
    setRecStatus("saved");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 4000);
    setNotes((n) => [
      ...n,
      {
        id: generateId("note"),
        type: "recording",
        text: `Walkthrough of ${sheet.id}`,
        author: "You",
        createdAt: Date.now(),
        sheetId: sheet.id,
        pinId: null,
        durationSeconds: recSeconds,
      },
    ]);
  }

  function clearRecording(): void {
    if (playTimer.current !== null) window.clearInterval(playTimer.current);
    setNotes((n) => n.filter((note) => note.type !== "recording"));
    setRecStatus("idle");
    setPlayProgress(null);
    setTrace([]);
    setRecSeconds(0);
  }

  function playRecording(): void {
    if (trace.length === 0 || playProgress !== null) return;
    const stepMs = 50;
    const steps = (PLAYBACK_SECONDS * 1000) / stepMs;
    let step = 0;
    setPlayProgress(0);
    playTimer.current = window.setInterval(() => {
      step += 1;
      if (step >= steps) {
        if (playTimer.current !== null) window.clearInterval(playTimer.current);
        playTimer.current = null;
        setPlayProgress(null);
      } else {
        setPlayProgress(step / steps);
      }
    }, stepMs);
  }

  function handleDrawingMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    if (recStatus !== "recording") return;
    const now = Date.now();
    if (now - lastTraceAt.current < 50) return;
    lastTraceAt.current = now;
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = {
      x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
    setTrace((t) => (t.length >= 500 ? [...t.slice(1), point] : [...t, point]));
  }

  // ── Split view ──
  function setPaneZoom(pane: "primary" | "compare", zoom: number): void {
    const next = clamp(zoom, 50, 200);
    setSplit((s) => ({
      ...s,
      primaryZoom: pane === "primary" || s.synced ? next : s.primaryZoom,
      compareZoom: pane === "compare" || s.synced ? next : s.compareZoom,
    }));
  }

  function startDividerDrag(e: React.MouseEvent): void {
    e.preventDefault();
    function onMove(ev: MouseEvent): void {
      const rect = splitStageRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSplit((s) => ({ ...s, dividerRatio: clamp((ev.clientX - rect.left) / rect.width, 0.25, 0.75) }));
    }
    function onUp(): void {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function openBlendPanel(): void {
    setBlendPanelOpen(true);
    setBlendMode((m) => m ?? "differences");
    setOpenPopover(null);
  }

  function exitWorkspace(): void {
    setOpenPopover(null);
    setBlendPanelOpen(false);
    setBlendMode(null);
    setSplit((s) => ({ ...s, open: false }));
    setSearchQuery("");
  }

  // ── Search ──
  const query = searchQuery.trim().toLowerCase();
  const sheetResults = query
    ? SHEETS.map((s, index) => ({ ...s, index })).filter(
        (s) => s.id.toLowerCase().includes(query) || s.title.toLowerCase().includes(query),
      )
    : [];
  const noteResults = query ? notes.filter((n) => n.text.toLowerCase().includes(query)) : [];
  const resultCount = sheetResults.length + noteResults.length;

  // ── Status bar text ──
  const saveState =
    recStatus === "recording"
      ? `Recording walkthrough · ${formatClock(recSeconds)}`
      : savedFlash
        ? "Walkthrough saved"
        : "All changes saved";
  const contextState = split.open
    ? `Comparing ${sheetAt(split.primaryIndex).id} / ${sheetAt(split.compareIndex).id}`
    : `Sheet ${sheet.id}${blendPanelOpen && blendMode ? ` · ${BLEND_MODES.find((m) => m.id === blendMode)?.label} · ${blendAmount}%` : ""}`;
  const activeToolLabel = TOOLS.find((t) => t.id === activeTool)?.label ?? "Select";

  const traceVisible = playProgress === null ? trace : trace.slice(0, Math.max(2, Math.floor(trace.length * playProgress)));
  const traceTip = traceVisible[traceVisible.length - 1];

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-white font-sans text-gray-900">
      {/* ── Top navigation ── */}
      <header className="relative z-40 flex shrink-0 items-center gap-2 border-b border-[#F0F0F0] bg-white px-3 py-2">
        <button
          type="button"
          onClick={exitWorkspace}
          title="Exit document review"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
        >
          <X size={15} /> Exit
        </button>
        <div className="flex items-center">
          <IconBtn
            label="Previous sheet"
            disabled={activeSheetIndex === 0}
            onClick={() => setActiveSheetIndex((i) => i - 1)}
          >
            <ChevronLeft size={17} />
          </IconBtn>
          <IconBtn
            label="Next sheet"
            disabled={activeSheetIndex === SHEETS.length - 1}
            onClick={() => setActiveSheetIndex((i) => i + 1)}
          >
            <ChevronRight size={17} />
          </IconBtn>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <FileText size={15} className="shrink-0 text-gray-400" />
          <span className="truncate text-sm font-semibold text-gray-900">
            {sheet.id} · {sheet.title}
          </span>
          <span className="hidden shrink-0 text-xs text-gray-500 sm:inline">
            {currentRevision} · {sheet.scale}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              data-popover-trigger
              aria-haspopup="true"
              aria-expanded={openPopover === "revision"}
              title="Select revision"
              onClick={() => setOpenPopover(openPopover === "revision" ? null : "revision")}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
            >
              {currentRevision} <ChevronDown size={12} />
            </button>
            {openPopover === "revision" && (
              <PopShell className="right-0 w-36">
                {REVISIONS.map((rev) => (
                  <button
                    key={rev}
                    type="button"
                    onClick={() => {
                      setSheetRevisions((r) => ({ ...r, [sheet.id]: rev }));
                      setOpenPopover(null);
                    }}
                    className={cn(POP_ITEM_CLS, "justify-between")}
                  >
                    {rev}
                    {rev === currentRevision ? <Check size={14} className="text-primary-600" /> : null}
                  </button>
                ))}
              </PopShell>
            )}
          </div>

          <IconBtn
            label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            pressed={isFavorite}
            onClick={() => setIsFavorite((f) => !f)}
            className={isFavorite ? "text-amber-500 hover:text-amber-500" : undefined}
          >
            <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
          </IconBtn>

          <div className="relative">
            <IconBtn
              label="Search sheets and notes (/)"
              data-popover-trigger
              hasPopup
              expanded={openPopover === "search"}
              onClick={() => setOpenPopover(openPopover === "search" ? null : "search")}
            >
              <Search size={16} />
            </IconBtn>
            {openPopover === "search" && (
              <PopShell className="right-0 w-80 p-3">
                <div className="flex items-center gap-2 rounded-lg bg-[#F6F6F6] px-2.5 py-2">
                  <Search size={14} className="shrink-0 text-gray-400" />
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSearchQuery("");
                        setOpenPopover(null);
                      }
                    }}
                    aria-label="Search sheets and markup"
                    placeholder="Search sheets and markup"
                    className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                  />
                  <Kbd>Esc</Kbd>
                </div>
                {!query ? (
                  <p className="px-1 pt-3 text-xs text-gray-400">Search sheets and markup</p>
                ) : resultCount === 0 ? (
                  <p className="px-1 pt-3 text-xs text-gray-500">No results for &ldquo;{searchQuery.trim()}&rdquo;</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto pt-2">
                    <p className="px-1 pb-1 text-[11px] text-gray-500">
                      {resultCount} result{resultCount === 1 ? "" : "s"}
                    </p>
                    {sheetResults.length > 0 && (
                      <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Sheets</p>
                    )}
                    {sheetResults.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setActiveSheetIndex(s.index);
                          setOpenPopover(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#F6F6F6]"
                      >
                        <FileText size={13} className="shrink-0 text-gray-400" />
                        <span className="font-medium text-gray-900">{s.id}</span>
                        <span className="truncate text-gray-500">{s.title}</span>
                      </button>
                    ))}
                    {noteResults.length > 0 && (
                      <p className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Markup &amp; Notes
                      </p>
                    )}
                    {noteResults.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          const index = SHEETS.findIndex((s) => s.id === n.sheetId);
                          if (index >= 0) setActiveSheetIndex(index);
                          setOpenPopover(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#F6F6F6]"
                      >
                        <MessageSquare size={13} className="shrink-0 text-gray-400" />
                        <span className="truncate text-gray-600">{n.text}</span>
                        <span className="ml-auto shrink-0 text-gray-400">{n.sheetId}</span>
                      </button>
                    ))}
                  </div>
                )}
              </PopShell>
            )}
          </div>

          <IconBtn
            label={markupVisible ? "Hide all markup" : "Show all markup"}
            pressed={markupVisible}
            onClick={() => setMarkupVisible((v) => !v)}
          >
            {markupVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </IconBtn>

          <div className="relative">
            <button
              type="button"
              data-popover-trigger
              aria-haspopup="true"
              aria-expanded={openPopover === "reviewTools"}
              title="Review tools"
              onClick={() => setOpenPopover(openPopover === "reviewTools" ? null : "reviewTools")}
              className="flex items-center gap-1.5 rounded-lg border border-[#EDEDED] bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-[#F6F6F6]"
            >
              <span className="hidden sm:inline">Review Tools</span>
              <MoreHorizontal size={16} className="sm:hidden" />
              <ChevronDown size={13} className="hidden sm:inline" />
            </button>
            {openPopover === "reviewTools" && (
              <PopShell className="right-0 w-56">
                <button type="button" onClick={openBlendPanel} className={POP_ITEM_CLS}>
                  <Layers size={15} /> Compare Revisions
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSplit((s) => ({ ...s, open: !s.open }));
                    setOpenPopover(null);
                  }}
                  className={POP_ITEM_CLS}
                >
                  <Columns2 size={15} /> {split.open ? "Exit Split View" : "Split View"}
                </button>
                <button type="button" onClick={startRecording} className={POP_ITEM_CLS}>
                  <Video size={15} /> Record Walkthrough
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMarkupVisible((v) => !v);
                    setOpenPopover(null);
                  }}
                  className={POP_ITEM_CLS}
                >
                  {markupVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                  {markupVisible ? "Hide Markup" : "Show Markup"}
                </button>
              </PopShell>
            )}
          </div>
        </div>
      </header>

      {/* ── Markup toolbar ── */}
      <div className="relative z-30 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[#F0F0F0] bg-white px-3 py-1.5">
        {TOOLS.map(({ id, label, shortcut, Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={activeTool === id}
            title={`${label} (${shortcut})`}
            onClick={() => setActiveTool(id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              activeTool === id
                ? "bg-primary-600 text-white ring-1 ring-primary-200"
                : "text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900",
            )}
          >
            <Icon size={15} />
            <span className="hidden lg:inline">{label}</span>
            <Kbd className="hidden md:inline-block">{shortcut}</Kbd>
          </button>
        ))}

        <div className="relative ml-1">
          <button
            type="button"
            data-popover-trigger
            aria-label="Markup color"
            aria-haspopup="true"
            aria-expanded={openPopover === "color"}
            title="Markup color"
            onClick={() => setOpenPopover(openPopover === "color" ? null : "color")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-[#F6F6F6]"
          >
            <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: markupColor }} />
            <ChevronDown size={12} className="text-gray-400" />
          </button>
          {openPopover === "color" && (
            <PopShell className="left-0 flex w-max gap-1.5 p-2">
              {MARKUP_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  aria-label={`${color.label} markup color`}
                  title={color.label}
                  onClick={() => {
                    setMarkupColor(color.value);
                    setOpenPopover(null);
                  }}
                  className="flex size-7 items-center justify-center rounded-full border border-black/10"
                  style={{ backgroundColor: color.value }}
                >
                  {markupColor === color.value ? <Check size={13} className="text-white drop-shadow" /> : null}
                </button>
              ))}
            </PopShell>
          )}
        </div>

        <button
          type="button"
          title="Compare revisions"
          onClick={openBlendPanel}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-[#EDEDED] px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
        >
          <Layers size={14} /> Compare
        </button>
      </div>

      {/* ── Workspace ── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative flex min-h-0 min-w-0 flex-[2] flex-col overflow-hidden">
          {!split.open ? (
            <div className="relative min-h-0 flex-1 overflow-auto bg-[#F0F0F0] p-4 sm:p-8">
              <div
                ref={drawingRef}
                onClick={handleDrawingClick}
                onMouseMove={handleDrawingMouseMove}
                className={cn(
                  "relative mx-auto w-full max-w-4xl min-w-[560px] rounded-lg border border-[#E2E2E2] bg-white shadow-lg",
                  activeTool === "comment" && "cursor-crosshair",
                  activeTool === "pan" && "cursor-grab",
                )}
              >
                <img src={sheet.image} alt={sheet.alt} className="block w-full rounded-lg" draggable={false} />

                {blendPanelOpen && blendMode && (
                  <>
                    <img
                      src={compareSheet.image}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="pointer-events-none absolute inset-0 h-full w-full rounded-lg"
                      style={
                        blendMode === "differences"
                          ? { mixBlendMode: "difference", opacity: blendAmount / 100 }
                          : blendMode === "ghost"
                            ? { opacity: (blendAmount / 100) * 0.6, filter: "grayscale(0.9)" }
                            : { mixBlendMode: "multiply", opacity: blendAmount / 100 }
                      }
                    />
                    {blendMode === "highlight" && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-lg bg-yellow-300"
                        style={{ mixBlendMode: "multiply", opacity: (blendAmount / 100) * 0.35 }}
                      />
                    )}
                    <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-red-700 shadow-sm ring-1 ring-black/10">
                      <span className="size-2 rounded-full bg-red-500" /> {sheet.id} · {currentRevision} (current)
                    </span>
                    <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-sky-700 shadow-sm ring-1 ring-black/10">
                      <span className="size-2 rounded-full bg-sky-500" /> {compareSheet.id} · {compareSheet.revision} (compare)
                    </span>
                  </>
                )}

                {markupVisible &&
                  sheetPins.map((pin) => {
                    const number = sheetPins.indexOf(pin) + 1;
                    return (
                      <span
                        key={pin.id}
                        title={`Pin ${number}`}
                        className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-lg"
                        style={{ left: `${pin.x}%`, top: `${pin.y}%`, backgroundColor: pin.color }}
                      >
                        {number}
                      </span>
                    );
                  })}

                {(recStatus === "recording" || (recStatus === "saved" && trace.length > 1)) && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    <polyline
                      points={traceVisible.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke="#004DE7"
                      strokeWidth="0.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.55"
                    />
                    {traceTip && (
                      <circle cx={traceTip.x} cy={traceTip.y} r="1.1" fill="#004DE7" />
                    )}
                  </svg>
                )}
              </div>
            </div>
          ) : (
            <div ref={splitStageRef} className="flex min-h-0 flex-1 flex-col gap-2 bg-[#F0F0F0] p-3 md:flex-row md:gap-0">
              <div className="flex min-h-0 min-w-0 flex-1 md:flex-none" style={{ flexBasis: `${split.dividerRatio * 100}%` }}>
                <SheetPane
                  paneKey="primary"
                  label="Primary"
                  sheetIndex={split.primaryIndex}
                  zoom={split.primaryZoom}
                  locked={false}
                  optionsOpen={openPopover === "paneOptsPrimary"}
                  onToggleOptions={() => setOpenPopover(openPopover === "paneOptsPrimary" ? null : "paneOptsPrimary")}
                  onSheetChange={(index) => setSplit((s) => ({ ...s, primaryIndex: index }))}
                  onZoomChange={(zoom) => setPaneZoom("primary", zoom)}
                  onFit={() => {
                    setSplit((s) => ({ ...s, primaryZoom: 100, compareZoom: s.synced ? 100 : s.compareZoom }));
                    setOpenPopover(null);
                  }}
                />
              </div>

              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize panes"
                onMouseDown={startDividerDrag}
                className="hidden w-2 shrink-0 cursor-col-resize flex-col items-center justify-center gap-2 md:flex"
              >
                <span className="h-16 w-1 rounded-full bg-gray-300" />
              </div>
              <div className="flex items-center justify-center gap-2 md:hidden">
                <span className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                <SheetPane
                  paneKey="compare"
                  label="Compare"
                  sheetIndex={split.compareIndex}
                  zoom={split.compareZoom}
                  locked={split.locked}
                  optionsOpen={openPopover === "paneOptsCompare"}
                  onToggleOptions={() => setOpenPopover(openPopover === "paneOptsCompare" ? null : "paneOptsCompare")}
                  onSheetChange={(index) => setSplit((s) => ({ ...s, compareIndex: index }))}
                  onZoomChange={(zoom) => setPaneZoom("compare", zoom)}
                  onFit={() => {
                    setSplit((s) => ({ ...s, compareZoom: 100, primaryZoom: s.synced ? 100 : s.primaryZoom }));
                    setOpenPopover(null);
                  }}
                />
              </div>

              <div className="absolute right-5 top-5 z-20 flex items-center gap-1 rounded-lg bg-white/95 p-1 shadow-lg ring-1 ring-black/5">
                <IconBtn
                  label={split.locked ? "Unlock compare pane" : "Lock compare pane"}
                  pressed={split.locked}
                  active={split.locked}
                  onClick={() => setSplit((s) => ({ ...s, locked: !s.locked }))}
                  className="size-7"
                >
                  {split.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </IconBtn>
                <IconBtn
                  label={split.synced ? "Disable zoom sync" : "Sync zoom across panes"}
                  pressed={split.synced}
                  active={split.synced}
                  onClick={() =>
                    setSplit((s) => ({ ...s, synced: !s.synced, compareZoom: !s.synced ? s.primaryZoom : s.compareZoom }))
                  }
                  className="size-7"
                >
                  <Columns2 size={13} />
                </IconBtn>
                <button
                  type="button"
                  aria-label="Exit Split View"
                  title="Exit Split View"
                  onClick={() => setSplit((s) => ({ ...s, open: false }))}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
                >
                  <X size={13} /> Exit Split View
                </button>
              </div>
            </div>
          )}

          {/* ── Blend comparison panel ── */}
          {blendPanelOpen && !split.open && (
            <div className="z-30 w-full border-t border-[#EDEDED] bg-white p-3 md:absolute md:bottom-4 md:left-1/2 md:w-[560px] md:max-w-[calc(100%-2rem)] md:-translate-x-1/2 md:rounded-2xl md:border md:shadow-xl md:ring-1 md:ring-black/5">
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-0.5" role="group" aria-label="Blend mode">
                  {BLEND_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={blendMode === mode.id}
                      onClick={() => setBlendMode(mode.id)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        blendMode === mode.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSplit((s) => ({ ...s, open: true }))}
                  className="flex items-center gap-1.5 rounded-lg border border-[#EDEDED] px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
                >
                  <Columns2 size={13} /> Split View
                </button>
                <IconBtn
                  label="Close comparison panel"
                  onClick={() => {
                    setBlendPanelOpen(false);
                    setBlendMode(null);
                  }}
                  className="ml-auto"
                >
                  <X size={15} />
                </IconBtn>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-gray-700">
                  {sheet.id} · {currentRevision}
                  <span className="px-1.5 text-gray-400">vs</span>
                  <label htmlFor="compare-sheet" className="sr-only">
                    Comparison sheet
                  </label>
                  <select
                    id="compare-sheet"
                    value={compareSheetIndex}
                    onChange={(e) => setCompareSheetIndex(Number(e.target.value))}
                    className="rounded-md bg-[#F6F6F6] px-1.5 py-1 text-xs text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                  >
                    {SHEETS.map((s, i) => (
                      <option key={s.id} value={i}>
                        {s.id} · {s.revision}
                      </option>
                    ))}
                  </select>
                </span>
                <button
                  type="button"
                  onClick={() => setBlendAmount(50)}
                  className="rounded-md px-2 py-1 font-medium text-primary-600 hover:bg-[#F6F6F6]"
                >
                  Reset
                </button>
              </div>

              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>
                    {blendMode === "ghost" ? "Ghost opacity" : blendMode === "highlight" ? "Highlight intensity" : "Revision overlay"}
                  </span>
                  <span className="font-mono text-gray-700">{blendAmount}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={blendAmount}
                  aria-label="Blend amount"
                  aria-valuetext={`${blendAmount} percent overlay`}
                  onChange={(e) => setBlendAmount(Number(e.target.value))}
                  className="mt-1 w-full accent-primary-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Original</span>
                  <span>Overlay</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Floating record button ── */}
          <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-1.5 md:bottom-20">
            {recStatus === "idle" && (
              <span className="rounded-md bg-white/95 px-2 py-1 text-[10px] text-gray-500 shadow-sm ring-1 ring-black/5">
                Captures your voice and mouse movement over the drawing
              </span>
            )}
            <button
              type="button"
              aria-label={recStatus === "recording" ? "Stop recording" : "Record walkthrough"}
              title={recStatus === "recording" ? "Stop recording" : "Record walkthrough"}
              onClick={() => (recStatus === "recording" ? stopRecording() : startRecording())}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-xl transition-colors",
                recStatus === "recording" ? "bg-red-600 text-white hover:bg-red-500" : "bg-primary-600 text-white hover:bg-primary-700",
              )}
            >
              {recStatus === "recording" ? (
                <>
                  <span className="size-2 animate-pulse rounded-full bg-white" />
                  <Square size={13} fill="currentColor" /> Stop · {formatClock(recSeconds)}
                </>
              ) : (
                <>
                  <Video size={15} /> Record Walkthrough
                </>
              )}
            </button>
          </div>
        </section>

        {/* ── Review notes panel ── */}
        <aside
          className={cn(
            "flex shrink-0 flex-col border-t border-[#F0F0F0] bg-white lg:border-l lg:border-t-0",
            notesPanelOpen ? "max-h-[45dvh] lg:max-h-none lg:w-80" : "lg:w-12",
          )}
        >
          <div className="flex items-center gap-2 border-b border-[#F0F0F0] px-3 py-2.5">
            {notesPanelOpen ? (
              <>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Review Notes</p>
                  <p className="text-[11px] text-gray-500">
                    {commentCount} note{commentCount === 1 ? "" : "s"} · {recordingCount} recording{recordingCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startRecording}
                  title="Record walkthrough"
                  className="ml-auto flex items-center gap-1 rounded-lg border border-[#EDEDED] px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
                >
                  <Video size={12} /> Record
                </button>
              </>
            ) : null}
            <IconBtn
              label={notesPanelOpen ? "Collapse review notes" : "Expand review notes"}
              pressed={notesPanelOpen}
              onClick={() => setNotesPanelOpen((o) => !o)}
              className={notesPanelOpen ? undefined : "mx-auto"}
            >
              {notesPanelOpen ? <ChevronRight size={15} className="hidden lg:block" /> : <MessageSquare size={15} />}
              {notesPanelOpen ? <ChevronDown size={15} className="lg:hidden" /> : null}
            </IconBtn>
          </div>

          {notesPanelOpen && (
            <>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {orderedNotes.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#D9D9D9] bg-[#FAFAFA] px-4 py-8 text-center">
                    <MessageSquare size={20} className="text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">No review notes yet</p>
                    <p className="text-xs text-gray-500">Drop a pin with the comment tool or record a walkthrough.</p>
                  </div>
                ) : (
                  orderedNotes.map((note) => (
                    <article key={note.id} className="rounded-xl border border-[#EDEDED] bg-[#FAFAFA] p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                            note.type === "recording" ? "bg-red-600" : "bg-primary-600",
                          )}
                        >
                          {note.type === "recording" ? <Video size={11} /> : note.author.charAt(0)}
                        </span>
                        <p className="text-xs font-semibold text-gray-900">
                          {note.author} <span className="font-normal text-gray-500">{relativeTime(note.createdAt)}</span>
                        </p>
                        {note.type === "recording" && note.durationSeconds !== null && (
                          <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600">
                            {formatClock(note.durationSeconds)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-gray-600">{note.text}</p>
                      {note.type === "recording" ? (
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={playRecording}
                            disabled={playProgress !== null}
                            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            <Play size={11} fill="currentColor" />
                            {playProgress !== null ? "Playing…" : "Play Recording"}
                          </button>
                          <span className="text-[10px] text-gray-500">Voice + mouse movement</span>
                          <IconBtn label="Clear recording" onClick={clearRecording} className="ml-auto size-7 text-gray-400 hover:text-red-600">
                            <Trash2 size={13} />
                          </IconBtn>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const index = SHEETS.findIndex((s) => s.id === note.sheetId);
                            if (index >= 0) setActiveSheetIndex(index);
                          }}
                          className="mt-2 flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200"
                        >
                          {note.pinId ? <MapPin size={10} /> : <FileText size={10} />}
                          {note.pinId ? "Pinned" : "Sheet"} · {note.sheetId}
                        </button>
                      )}
                    </article>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-[#F0F0F0] p-3">
                {pendingPinId && (
                  <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary-50 px-1.5 py-1 text-[10px] font-medium text-primary-700">
                    <MapPin size={10} /> {sheet.id}
                  </span>
                )}
                <input
                  ref={composerRef}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === "Enter") submitComment();
                  }}
                  aria-label="Add a comment"
                  placeholder={pendingPinId ? "Describe the pinned spot…" : "Add a comment…"}
                  className="h-9 w-full min-w-0 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
                />
                <button
                  type="button"
                  aria-label="Send comment"
                  title="Send comment"
                  onClick={submitComment}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── Status bar ── */}
      <footer
        role="status"
        aria-live="polite"
        className="flex shrink-0 items-center gap-3 border-t border-[#F0F0F0] bg-white px-3 py-1.5 text-[11px] text-gray-500"
      >
        <span className="flex items-center gap-1.5">
          {recStatus === "recording" ? (
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
          ) : (
            <Check size={12} className="text-green-600" />
          )}
          {saveState}
        </span>
        <span className="mx-auto truncate text-gray-700">{contextState}</span>
        <span className="flex shrink-0 items-center gap-2">
          Tool: {activeToolLabel}
          {!markupVisible && <span className="flex items-center gap-1 text-amber-600"><EyeOff size={11} /> Markup hidden</span>}
        </span>
      </footer>
    </main>
  );
}
