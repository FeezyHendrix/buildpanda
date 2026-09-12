import { useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/atoms/button";
import { SearchInput } from "@/components/atoms/search-input";
import { cn } from "@/lib/utils";
import { NRM_WORK_SECTIONS, type NrmWorkItem } from "@/lib/nrm-work-items";

interface ActivityTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: NrmWorkItem) => void;
  onBlank: () => void;
}

function filterSections(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return NRM_WORK_SECTIONS;
  return NRM_WORK_SECTIONS.map((section) => {
    const items = section.items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q) ||
        section.group.toLowerCase().includes(q),
    );
    return { ...section, items };
  }).filter((section) => section.items.length > 0);
}

function ActivityTemplateDialog({
  open,
  onOpenChange,
  onPick,
  onBlank,
}: ActivityTemplateDialogProps) {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => filterSections(query), [query]);

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
              Start from a standard NRM2 work section, then complete the activity details.
            </Dialog.Description>
          </header>

          <div className="border-b border-line-hair px-6 py-4">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search work items (e.g. concrete, roofing, electrical)"
              autoFocus
            />
          </div>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            {sections.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">
                No work items match “{query}”.
              </p>
            ) : (
              sections.map((section) => (
                <div key={section.code} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-500">
                      NRM2 · {section.code}
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {section.group}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {section.items.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => onPick(item)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border border-line-hair bg-white px-3.5 py-3 text-left",
                          "transition-colors hover:border-primary-500 hover:bg-primary-50",
                          "outline-none focus-visible:shadow-focus",
                        )}
                      >
                        <span className="text-sm font-medium text-ink">{item.name}</span>
                        <span className="font-mono text-xs text-ink-muted">{item.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
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

ActivityTemplateDialog.displayName = "ActivityTemplateDialog";

export { ActivityTemplateDialog };
