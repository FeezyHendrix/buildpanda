import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { RichTextEditor } from "@/components/molecules/rich-text-editor";
import type { ComboItem } from "@/components/molecules/combo-select";
import { toast } from "@/lib/toast";
import type { Task, TaskPriority } from "@/lib/project-types";
import {
  type AssigneeOption,
  FIELD,
  PRIORITY_META,
  PRIORITY_ORDER,
  PriorityIcon,
} from "./task-ui";
import { TaskExtras } from "./task-extras";
import { TaskImageGallery } from "./task-image-gallery";

export function UpsertTaskDialog({
  open,
  onOpenChange,
  projectId,
  task,
  allTasks,
  userOptions,
  teamOptions,
  selfId,
  submitting,
  onSubmit,
  onRequestDelete,
  onOpenTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task: Task | null;
  allTasks: Task[];
  userOptions: AssigneeOption[];
  teamOptions: AssigneeOption[];
  selfId: string | null;
  submitting: boolean;
  onSubmit: (values: { title: string; description: string; descriptionHtml: string; assignees: AssigneeOption[]; dueDate: string | null; priority: TaskPriority; labels: string[] }) => void;
  onRequestDelete?: () => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [assigneeValues, setAssigneeValues] = useState<string[]>([]);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [dueDate, setDueDate] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState<string>("");

  const dialogKey = task?.id ?? "new";

  const assigneeItems = useMemo<ComboItem[]>(
    () => [
      ...userOptions.map((o) => ({ id: `user:${o.id}`, label: o.name, group: "Person" })),
      ...teamOptions.map((o) => ({ id: `team:${o.id}`, label: o.name, group: "Team" })),
    ],
    [userOptions, teamOptions],
  );

  const [linkCopied, setLinkCopied] = useState(false);

  function copyTaskLink(): void {
    if (!task) return;
    const url = `${window.location.origin}${window.location.pathname}?task=${task.id}`;
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 1500);
      })
      .catch(() => toast("Could not copy link"));
  }

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setDescriptionHtml(task?.descriptionHtml ?? task?.description ?? "");
      setAssigneeValues(
        task?.assignees?.map((assignee) => `${assignee.kind}:${assignee.id}`) ??
          (task?.assigneeId
            ? [`user:${task.assigneeId}`]
            : task?.assigneeTeamMemberId
              ? [`team:${task.assigneeTeamMemberId}`]
              : []),
      );
      setDueDate(task?.dueDate ? task.dueDate.slice(0, 10) : "");
      setPriority(task?.priority ?? "Medium");
      setLabels(task?.labels ?? []);
      setLabelDraft("");
      setAssigneePickerOpen(false);
    }
  }, [open, dialogKey]);

  function addLabel(raw: string): void {
    const label = raw.trim().slice(0, 40);
    if (!label) return;
    setLabels((prev) =>
      prev.some((l) => l.toLowerCase() === label.toLowerCase()) || prev.length >= 20
        ? prev
        : [...prev, label],
    );
    setLabelDraft("");
  }

  function removeLabel(label: string): void {
    setLabels((prev) => prev.filter((l) => l !== label));
  }

  function toggleAssignee(value: string): void {
    setAssigneeValues((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }

  function resolveAssignees(): AssigneeOption[] {
    return assigneeValues.flatMap((value) => {
      const [kind, id] = value.split(":");
      const pool = kind === "team" ? teamOptions : userOptions;
      const found = pool.find((o) => o.id === id);
      return found ? [found] : [];
    });
  }

  function assigneeLabel(value: string): string {
    return assigneeItems.find((option) => option.id === value)?.label ?? value;
  }

  function handleSubmit(): void {
    if (!title.trim()) return;
    const html = descriptionHtml.trim();
    const isEmpty = html === "" || html === "<p></p>";
    const draft = labelDraft.trim().slice(0, 40);
    const finalLabels =
      draft && !labels.some((l) => l.toLowerCase() === draft.toLowerCase()) && labels.length < 20
        ? [...labels, draft]
        : labels;
    onSubmit({
      title: title.trim(),
      description: isEmpty ? "" : description.trim(),
      descriptionHtml: isEmpty ? "" : html,
      assignees: resolveAssignees(),
      dueDate: dueDate || null,
      priority,
      labels: finalLabels,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Edit task" : "New task"}
      submitLabel={task ? "Save" : "Create task"}
      submitDisabled={!title.trim()}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      {task && (
        <button
          type="button"
          onClick={copyTaskLink}
          className="-mt-1 flex items-center gap-1.5 self-start rounded-lg bg-[#F6F6F6] px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.07 0l1.93-1.93a5 5 0 0 0-7.07-7.07L10.5 5.5" />
            <path d="M14 11a5 5 0 0 0-7.07 0L5 12.93a5 5 0 0 0 7.07 7.07L13.5 18.5" />
          </svg>
          {linkCopied ? "Link copied" : "Copy task link"}
        </button>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-title">Title</Label>
        <input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Inspect scaffolding"
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-desc">Description (optional)</Label>
        <RichTextEditor
          value={descriptionHtml}
          onChange={(html, text) => {
            setDescriptionHtml(html);
            setDescription(text);
          }}
          projectId={projectId}
          placeholder="Add details, checklists, images…"
        />
      </div>
      <TaskImageGallery
        descriptionHtml={descriptionHtml}
        onDescriptionChange={(html, text) => {
          setDescriptionHtml(html);
          setDescription(text);
        }}
        projectId={projectId}
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Assignees</Label>
          {selfId && !assigneeValues.includes(`user:${selfId}`) && (
            <button
              type="button"
              onClick={() => {
                setAssigneeValues((prev) => [...prev, `user:${selfId}`]);
                setAssigneePickerOpen(false);
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Assign to me
            </button>
          )}
        </div>
        <div className="rounded-lg bg-[#F6F6F6] p-2">
          <button
            type="button"
            onClick={() => setAssigneePickerOpen((prev) => !prev)}
            aria-expanded={assigneePickerOpen}
            className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md bg-white px-2.5 py-2 text-left text-sm text-gray-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            <span className="min-w-0 flex-1 truncate text-gray-400">
              {assigneeValues.length === 0
                ? "Select assignees"
                : assigneeValues.length === 1
                  ? assigneeLabel(assigneeValues[0]!)
                  : `${assigneeLabel(assigneeValues[0]!)} +${assigneeValues.length - 1}`}
            </span>
            <span className="text-gray-400">▾</span>
          </button>
          {assigneeValues.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {assigneeValues.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleAssignee(value)}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:text-gray-900"
                >
                  {assigneeLabel(value)}
                  <span className="text-gray-400">×</span>
                </button>
              ))}
            </div>
          )}
          {assigneePickerOpen && (
            <div className="mt-2 max-h-44 overflow-y-auto rounded-md bg-white p-1">
            {assigneeItems.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={assigneeValues.includes(item.id)}
                  onChange={() => toggleAssignee(item.id)}
                  className="size-4 rounded border-gray-300"
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.group && <span className="text-xs text-gray-400">{item.group}</span>}
              </label>
            ))}
            {assigneeItems.length === 0 && <p className="px-2 py-1.5 text-sm text-gray-400">No people found</p>}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-due">Due date (optional)</Label>
        <input
          id="task-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Priority</Label>
        <div className="flex gap-2">
          {PRIORITY_ORDER.map((p) => {
            const meta = PRIORITY_META[p];
            const selected = priority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                aria-pressed={selected}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                <Badge tone={meta.tone} variant={selected ? "solid" : "soft"} size="md">
                  <PriorityIcon shape={meta.shape} />
                  {p}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-labels">Labels (optional)</Label>
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-[#F6F6F6] py-0.5 pl-2.5 pr-1 text-xs font-medium text-gray-700"
              >
                {label}
                <button
                  type="button"
                  onClick={() => removeLabel(label)}
                  aria-label={`Remove label ${label}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          id="task-labels"
          type="text"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addLabel(labelDraft);
            } else if (e.key === "Backspace" && labelDraft === "" && labels.length > 0) {
              const last = labels[labels.length - 1];
              if (last) removeLabel(last);
            }
          }}
          onBlur={() => addLabel(labelDraft)}
          placeholder="Add a label, press Enter"
          maxLength={40}
          className={FIELD}
        />
      </div>
      {task && (task.createdByName || task.createdAt) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {task.createdByName && (
            <span>
              Reporter <span className="font-medium text-gray-700">{task.createdByName}</span>
            </span>
          )}
          {task.createdAt && (
            <span>
              Created{" "}
              <span className="font-medium text-gray-700">
                {new Date(task.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </span>
            </span>
          )}
        </div>
      )}
      {task && (
        <TaskExtras projectId={projectId} taskId={task.id} allTasks={allTasks} onOpenTask={onOpenTask} />
      )}
      {onRequestDelete && (
        <button
          type="button"
          onClick={onRequestDelete}
          className="mt-1 self-start text-sm font-medium text-red-500 hover:text-red-600"
        >
          Delete task
        </button>
      )}
    </FormDrawer>
  );
}
UpsertTaskDialog.displayName = "UpsertTaskDialog";
