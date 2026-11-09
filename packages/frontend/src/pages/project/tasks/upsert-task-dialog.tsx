import { useEffect, useMemo, useState } from "react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { RichTextEditor } from "@/components/molecules/rich-text-editor";
import { MultiSearchableSelect } from "@/components/atoms/multi-searchable-select";
import { Select } from "@/components/atoms/select";
import { TextInput } from "@/components/atoms/text-input";
import type { ComboItem } from "@/components/molecules/combo-select";
import { toast } from "@/lib/toast";
import type { Task, TaskPriority } from "@/lib/project-types";
import { type AssigneeOption, PRIORITY_ORDER } from "./task-ui";
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

  const assigneeSelectItems = useMemo(
    () => assigneeItems.map((i) => ({ value: i.id, label: i.label, meta: i.group })),
    [assigneeItems],
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

  function resolveAssignees(): AssigneeOption[] {
    return assigneeValues.flatMap((value) => {
      const [kind, id] = value.split(":");
      const pool = kind === "team" ? teamOptions : userOptions;
      const found = pool.find((o) => o.id === id);
      return found ? [found] : [];
    });
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

  const priorityOptions = PRIORITY_ORDER.map((p) => ({ value: p, label: p }));

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Edit task" : "New task"}
      description={task ? "Update the task details." : undefined}
      submitLabel={task ? "Save" : "Create Task"}
      submitDisabled={!title.trim()}
      submitting={submitting}
      onSubmit={handleSubmit}
      footerVariant="stacked"
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

      {/* Title */}
      <TextInput
        label="Title"
        value={title}
        onChange={setTitle}
        placeholder="e.g Rob a bank"
        autoFocus
      />

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium leading-none text-[#1E1E1E]">
          Description <span className="font-normal text-[#B0B0B0]">(optional)</span>
        </label>
        <RichTextEditor
          value={descriptionHtml}
          onChange={(html, text) => {
            setDescriptionHtml(html);
            setDescription(text);
          }}
          projectId={projectId}
          placeholder="Describe what this task entails."
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

      {/* Assignees */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-caption-l font-medium text-black-500">Assignees</label>
          {selfId && !assigneeValues.includes(`user:${selfId}`) && (
            <button
              type="button"
              onClick={() => setAssigneeValues((prev) => [...prev, `user:${selfId}`])}
              className="text-xs font-medium text-[#004DE7] hover:underline"
            >
              Assign to me
            </button>
          )}
        </div>
        <MultiSearchableSelect
          items={assigneeSelectItems}
          values={assigneeValues}
          onChange={setAssigneeValues}
          placeholder="Select Assignees"
          searchPlaceholder="Search assignees"
          emptyText="No people found"
        />
      </div>

      {/* Due date */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="task-due" className="text-[13px] font-medium leading-none text-[#1E1E1E]">
          Due date <span className="font-normal text-[#B0B0B0]">(optional)</span>
        </label>
        <input
          id="task-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          placeholder="DD/MM/YY"
          className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-[14px] text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
        />
      </div>

      {/* Priority - Select dropdown */}
      <div className="flex flex-col gap-1.5">
        <label className="text-caption-l font-medium text-black-500">Priority</label>
        <Select
          options={priorityOptions}
          value={priority}
          onChange={(v) => v && setPriority(v as TaskPriority)}
          placeholder="Select Priority"
        />
      </div>

      {/* Labels */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="task-labels" className="text-[13px] font-medium leading-none text-[#1E1E1E]">
          Labels <span className="font-normal text-[#B0B0B0]">(optional)</span>
        </label>
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
          placeholder="Add a label"
          maxLength={40}
          className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-[14px] text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
        />
      </div>

      {task && (task.createdByName || task.createdAt) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border border-[#EBEBEB] bg-[#FAFAFA] px-3 py-2 text-xs text-[#767676]">
          {task.createdByName && (
            <span>
              Reporter <span className="font-medium text-[#1E1E1E]">{task.createdByName}</span>
            </span>
          )}
          {task.createdAt && (
            <span>
              Created{" "}
              <span className="font-medium text-[#1E1E1E]">
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
          className="self-start text-sm font-medium text-[#E7000B] hover:text-[#A30006]"
        >
          Delete task
        </button>
      )}
    </FormDrawer>
  );
}
UpsertTaskDialog.displayName = "UpsertTaskDialog";
