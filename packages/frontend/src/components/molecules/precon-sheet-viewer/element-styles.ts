// One colour per BESMM element so a sheet reads like a legend; matched on the
// element group text because agent-built lines name elements freely.
export const ELEMENT_STYLES = [
  { match: "wall finish", color: "#059669", label: "Wall finishes" },
  { match: "ceiling finish", color: "#10b981", label: "Ceiling finishes" },
  { match: "floor finish", color: "#16a34a", label: "Floor finishes" },
  { match: "measured areas", color: "#16a34a", label: "Measured areas" },
  { match: "wall", color: "#4f46e5", label: "Walls" },
  { match: "window", color: "#06b6d4", label: "Windows" },
  { match: "door", color: "#f59e0b", label: "Doors" },
  { match: "frame", color: "#9333ea", label: "Frame" },
  { match: "column", color: "#9333ea", label: "Frame" },
  { match: "beam", color: "#9333ea", label: "Frame" },
  { match: "roof", color: "#0d9488", label: "Roof" },
  { match: "substructure", color: "#78716c", label: "Substructure" },
  { match: "piling", color: "#78716c", label: "Substructure" },
  { match: "mechanical", color: "#ea580c", label: "Mechanical services" },
  { match: "electrical", color: "#dc2626", label: "Electrical services" },
  { match: "external", color: "#4b5563", label: "External works" },
  { match: "pavement", color: "#4b5563", label: "External works" },
] as const;

export interface ElementStyle {
  color: string;
  label: string;
}

export const DEFAULT_ELEMENT_STYLE: ElementStyle = { color: "#2563eb", label: "Other" };

export function getElementStyle(elementGroup: string | null): ElementStyle {
  if (!elementGroup) return DEFAULT_ELEMENT_STYLE;
  const lower = elementGroup.toLowerCase();
  for (const style of ELEMENT_STYLES) {
    if (lower.includes(style.match)) return style;
  }
  return DEFAULT_ELEMENT_STYLE;
}
