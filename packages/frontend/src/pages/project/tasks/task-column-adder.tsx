import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { useAddColumn } from "@/hooks/use-tasks";
import { toast } from "@/lib/toast";

export function TaskColumnAdder({ projectId }: { projectId: string }) {
  const addColumn = useAddColumn(projectId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  function reset(): void {
    setAdding(false);
    setName("");
  }

  function commit(): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    addColumn.mutate(trimmed, {
      onSuccess: reset,
      onError: () => toast("Could not add column"),
    });
  }

  return (
    <div className="w-[85vw] shrink-0 snap-start sm:w-72">
      {adding ? (
        <div className="flex flex-col gap-2 border border-[#EBEBEB] bg-white p-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") reset();
            }}
            placeholder="Column name"
            className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-[14px] text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={commit}
              disabled={!name.trim()}
              loading={addColumn.isPending}
            >
              Add
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => setAdding(true)}
          className="w-[316px] flex justify-start bg-black-50 border-[0.3px] border-border"
        >
          <PlusIcon className="size-4" />
          Add new column
        </Button>
      )}
    </div>
  );
}

TaskColumnAdder.displayName = "TaskColumnAdder";
