import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Spinner } from "@/components/atoms/spinner";
import {
  useCreateInspectionCategory,
  useInspectionCategories,
} from "@/hooks/use-inspection-categories";
import { errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

interface InspectionCategoryPickerProps {
  projectId: string;
  value: string;
  onChange: (name: string) => void;
  /** Only a workspace admin may add to the list; the API refuses anyone else. */
  canAddCategory: boolean;
  id?: string;
}

/**
 * The categories a project can order an inspection under, read from
 * `GET /projects/:id/inspection-categories` — BuildPanda's own service
 * catalogue plus this workspace's additions. Never a hard-coded list: a road
 * job needs Earthworks and Pavement, and that is the workspace's call to make.
 */
function InspectionCategoryPicker({
  projectId,
  value,
  onChange,
  canAddCategory,
  id = "inspection-category",
}: InspectionCategoryPickerProps) {
  const { data: categories = [], isPending } = useInspectionCategories(projectId);
  const createCategory = useCreateInspectionCategory(projectId);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");

  // The first category is the sensible default, but only once the list has
  // arrived — before that there is nothing truthful to preselect.
  useEffect(() => {
    const first = categories[0];
    if (!value && first) onChange(first.name);
  }, [value, categories, onChange]);

  // An archived category never comes back from the API, so a record still
  // holding one would otherwise silently change category on edit.
  const missing = value && !categories.some((category) => category.name === value);

  function handleAdd(): void {
    const name = draftName.trim();
    if (!name) return;
    createCategory.mutate(
      { name, scope: "organization" },
      {
        onSuccess: (category) => {
          onChange(category.name);
          setDraftName("");
          setAdding(false);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Category</Label>
      {isPending ? (
        <div className="flex h-11 items-center px-1">
          <Spinner size="xs" />
        </div>
      ) : (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={INPUT_CLASS}
        >
          {missing ? <option value={value}>{value} (archived)</option> : null}
          {categories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
      )}

      {canAddCategory && !adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start text-xs font-semibold text-primary-500 hover:underline"
        >
          + Add a category
        </button>
      ) : null}

      {canAddCategory && adding ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-line-hair p-3">
          <Label htmlFor={`${id}-new`}>New category</Label>
          <div className="flex items-center gap-2">
            <input
              id={`${id}-new`}
              value={draftName}
              maxLength={80}
              autoFocus
              placeholder="e.g. Earthworks"
              onChange={(event) => setDraftName(event.target.value)}
              className={cn(INPUT_CLASS, "flex-1")}
            />
            <Button
              type="button"
              size="sm"
              loading={createCategory.isPending}
              disabled={draftName.trim().length === 0}
              onClick={handleAdd}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setDraftName("");
              }}
            >
              Cancel
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            Added for the whole workspace, on every project.
          </p>
          {createCategory.error ? (
            <p className="text-xs text-negative-500">{errorMessage(createCategory.error)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

InspectionCategoryPicker.displayName = "InspectionCategoryPicker";

export { InspectionCategoryPicker, type InspectionCategoryPickerProps };
