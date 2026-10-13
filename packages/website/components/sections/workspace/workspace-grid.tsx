import {
  CalendarRange,
  Camera,
  ChartGantt,
  Layers,
  ListChecks,
  MessageCircleQuestion,
  Stamp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { workspace, type WorkspaceFeatureId } from "@/content/workspace";

const icons: Record<WorkspaceFeatureId, LucideIcon> = {
  stages: Layers,
  team: Users,
  finances: Wallet,
  charts: ChartGantt,
  approvals: Stamp,
  tasks: ListChecks,
  lookAheads: CalendarRange,
  rfis: MessageCircleQuestion,
  updates: Camera,
};

/**
 * The workspace's features as one white block. The list's own colour shows
 * through a 1px gap as the dividers, so they are right at any column count.
 * With two columns the ninth cell spans the row, so no empty cell is left.
 */
export function WorkspaceGrid() {
  return (
    <ul className="workspace-grid grid gap-px sm:grid-cols-2 lg:grid-cols-3">
      {workspace.features.map((feature) => {
        const Icon = icons[feature.id];

        return (
          <li key={feature.id} className="bg-white p-6 text-ink sm:max-lg:last:col-span-2">
            <span className="flex size-9 items-center justify-center bg-brand text-white">
              <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </span>
            <h3 className="mt-4 text-[0.9375rem] font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm leading-normal text-pretty text-ink-soft">{feature.description}</p>
          </li>
        );
      })}
    </ul>
  );
}
