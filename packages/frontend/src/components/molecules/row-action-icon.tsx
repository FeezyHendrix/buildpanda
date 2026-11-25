import { ReactSVG } from "react-svg";
import { cn } from "@/lib/utils";
import { icons2 } from "@/assets/icons2/icon2";

/** The filled icons2 glyphs used in row and card dropdown menus. */
const SOURCES = {
  view: icons2.eye,
  edit: icons2.edit,
  delete: icons2.delete,
  schedule: icons2.timer,
  assign: icons2.addUser,
} as const;

export type RowActionIconName = keyof typeof SOURCES;

export function RowActionIcon({ name }: { name: RowActionIconName }) {
  return <ReactSVG src={SOURCES[name]} className={cn("flex shrink-0 [&_svg]:size-[16px]", name === "assign" && "[&_path]:fill-black")} aria-hidden />;
}

RowActionIcon.displayName = "RowActionIcon";
