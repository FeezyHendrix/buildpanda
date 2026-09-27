import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/atoms/button";
import { SearchInput } from "@/components/atoms/search-input";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { cn } from "@/lib/utils";
import {
  countMatches,
  filterSections,
  workItemLibrary,
  WORK_ITEM_LIBRARIES,
  type WorkItem,
  type WorkItemLibraryId,
} from "@/lib/work-items";

const LIBRARY_TABS = WORK_ITEM_LIBRARIES.map((library) => ({
  value: library.id,
  label: library.label,
}));

interface ActivityTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which library opens first — the road library on a civil project. */
  defaultLibraryId: WorkItemLibraryId;
  onPick: (item: WorkItem) => void;
  onBlank: () => void;
}

function ActivityTemplateDialog({
  open,
  onOpenChange,
  defaultLibraryId,
  onPick,
  onBlank,
}: ActivityTemplateDialogProps) {
  const [query, setQuery] = useState("");
  const [libraryId, setLibraryId] = useState<WorkItemLibraryId>(defaultLibraryId);

  // The project decides which library opens; reopening the picker after the
  // project loads must not leave the wrong trade on screen.
  useEffect(() => {
    if (open) setLibraryId(defaultLibraryId);
  }, [open, defaultLibraryId]);

  const library = workItemLibrary(libraryId);
  const sections = useMemo(() => filterSections(library.sections, query), [library, query]);
  const otherLibrary = WORK_ITEM_LIBRARIES.find((l) => l.id !== libraryId);
  const otherMatches = otherLibrary && query.trim() ? countMatches(otherLibrary, query) : 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(520px,100vw)] flex-col border-l border-line-hair bg-white shadow-drawer outline-none",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
          )}
        >
          <header className="border-b border-line-hair px-6 py-5">
            <Dialog.Title className="text-lg font-semibold text-ink">
              Choose a work item
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm text-ink-muted text-pretty">
              {library.description}
            </Dialog.Description>
            <div className="mt-3">
              <FilterTabs
                items={LIBRARY_TABS}
                value={libraryId}
                onChange={setLibraryId}
                ariaLabel="Work item library"
              />
            </div>
          </header>

          <div className="border-b border-line-hair px-6 py-4">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                libraryId === "civils"
                  ? "Search work items (e.g. asphalt, kerb, culvert, sub-base)"
                  : "Search work items (e.g. concrete, roofing, electrical)"
              }
              autoFocus
            />
          </div>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            {sections.length === 0 ? (
              <EmptyResult
                query={query}
                libraryLabel={library.label}
                otherLabel={otherLibrary?.label ?? null}
                otherMatches={otherMatches}
                onSwitch={() => otherLibrary && setLibraryId(otherLibrary.id)}
              />
            ) : (
              <>
                {otherMatches > 0 ? (
                  <SwitchHint
                    otherLabel={otherLibrary?.label ?? ""}
                    otherMatches={otherMatches}
                    onSwitch={() => otherLibrary && setLibraryId(otherLibrary.id)}
                  />
                ) : null}
                {sections.map((section) => (
                  <div key={section.code} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-500">
                        {library.standard} · {section.code}
                      </span>
                      <span className="text-sm font-semibold text-ink">{section.group}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {section.items.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => onPick(item)}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-lg border border-line-hair bg-white px-3.5 py-3 text-left",
                            "transition-colors hover:border-primary-500 hover:bg-primary-50",
                            "outline-none focus-visible:shadow-focus",
                          )}
                        >
                          <span className="text-sm font-medium text-ink">{item.name}</span>
                          <span className="shrink-0 rounded bg-surface-alt px-1.5 py-0.5 font-mono text-xs text-ink-muted">
                            {item.unit}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-line-hair px-6 py-4">
            <Button type="button" variant="ghost" size="md" onClick={onBlank}>
              Start from blank instead
            </Button>
            <Dialog.Close render={<Button type="button" variant="secondary" size="md">Cancel</Button>} />
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SwitchHint({
  otherLabel,
  otherMatches,
  onSwitch,
}: {
  otherLabel: string;
  otherMatches: number;
  onSwitch: () => void;
}) {
  return (
    <p className="rounded-lg bg-surface-alt px-3 py-2 text-xs text-ink-muted">
      {otherMatches} more in the {otherLabel} library.{" "}
      <button type="button" onClick={onSwitch} className="font-semibold text-primary-600 underline">
        Switch to {otherLabel}
      </button>
    </p>
  );
}

function EmptyResult({
  query,
  libraryLabel,
  otherLabel,
  otherMatches,
  onSwitch,
}: {
  query: string;
  libraryLabel: string;
  otherLabel: string | null;
  otherMatches: number;
  onSwitch: () => void;
}) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-ink-muted">
        No {libraryLabel} work items match “{query}”.
      </p>
      {otherLabel && otherMatches > 0 ? (
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onSwitch}>
          {otherMatches} match{otherMatches === 1 ? "" : "es"} in {otherLabel} — switch
        </Button>
      ) : null}
    </div>
  );
}

ActivityTemplateDialog.displayName = "ActivityTemplateDialog";

export { ActivityTemplateDialog };
