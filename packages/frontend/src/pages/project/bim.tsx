import { lazy, Suspense, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
// import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
// import { UploadBimDialog } from "@/components/molecules/upload-bim-dialog";
import type { SelectedElement } from "@/components/molecules/bim-viewer";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useBimModelFileUrl,
  useBimModelXktUrl,
  useBimModels,
  useBimModelIssues,
  useCreateBimIssue,
} from "@/hooks/use-bim";
import { useFeatureFlag } from "@/hooks/use-feature-flags";
import { useParticipants } from "@/hooks/use-participants";
import { canResourceAction } from "@/lib/project-types";
import type { BimModel } from "@/lib/project-types";

const BimViewer = lazy(() => import("@/components/molecules/bim-viewer"));
const XeokitViewer = lazy(() => import("@/components/molecules/xeokit-viewer"));

const STATUS_META: Record<
  string,
  { label: string; tone: "neutral" | "info" | "success" | "danger" }
> = {
  Processing: { label: "Processing", tone: "info" },
  Ready: { label: "Ready", tone: "success" },
  Failed: { label: "Failed", tone: "danger" },
};

function ModelCard({
  model,
  onOpen,
  canOpen,
}: {
  model: BimModel;
  onOpen: (model: BimModel) => void;
  canOpen: boolean;
}) {
  const meta = model.status ? STATUS_META[model.status] : null;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{model.name}</p>
          {model.discipline && (
            <p className="text-xs text-gray-500">{model.discipline}</p>
          )}
          {model.elementCount != null && (
            <p className="mt-1 text-xs text-gray-400">
              {model.elementCount} elements
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {meta && (
            <Badge tone={meta.tone} size="sm">
              {meta.label}
            </Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={!canOpen || model.status !== "Ready"}
            onClick={() => onOpen(model)}
          >
            Open viewer
          </Button>
        </div>
      </div>
    </Card>
  );
}

const BimIssueDashboard = lazy(() =>
  import("@/components/molecules/bim-issue-dashboard").then((m) => ({
    default: m.BimIssueDashboard,
  })),
);

export default function ProjectBim() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "bim", "manage");
  const dashboardPreview = useFeatureFlag("projects.bimDashboard");

  const { data: models = [], isLoading } = useBimModels(project.id);
  const fileUrl = useBimModelFileUrl();
  const xktUrl = useBimModelXktUrl();
  const createIssue = useCreateBimIssue();
  const { data: participants = [] } = useParticipants(project.id);
  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  // const [uploadOpen, setUploadOpen] = useState(false);
  const [active, setActive] = useState<BimModel | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [xktModelUrl, setXktModelUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueAssignee, setIssueAssignee] = useState("");

  const { data: activeIssues = [] } = useBimModelIssues(
    project.id,
    active?.id,
  );

  function openViewer(model: BimModel): void {
    setActive(model);
    setSelected(null);
    setModelUrl(null);
    setXktModelUrl(null);
    xktUrl.mutate(
      { projectId: project.id, modelId: model.id },
      {
        onSuccess: (data) => {
          if (data.url) {
            setXktModelUrl(data.url);
          } else {
            fileUrl.mutate(
              { projectId: project.id, modelId: model.id },
              { onSuccess: (ifc) => setModelUrl(ifc.url) },
            );
          }
        },
        onError: () => {
          fileUrl.mutate(
            { projectId: project.id, modelId: model.id },
            { onSuccess: (ifc) => setModelUrl(ifc.url) },
          );
        },
      },
    );
  }

  function closeViewer(): void {
    setActive(null);
    setModelUrl(null);
    setXktModelUrl(null);
    setSelected(null);
  }

  function addIssue(): void {
    if (!active || issueTitle.trim() === "") return;
    createIssue.mutate(
      {
        projectId: project.id,
        modelId: active.id,
        title: issueTitle,
        elementGuid: selected?.guid ?? null,
        assigneeId: issueAssignee || null,
      },
      {
        onSuccess: () => {
          setIssueTitle("");
          setIssueAssignee("");
        },
      },
    );
  }

  if (active) {
    return (
      <div className="absolute inset-0 flex flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-900">
              {active.name}
            </h2>
            <p className="text-xs text-gray-500">
              Click any element to see its details and assign it.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={closeViewer}>
            Back to models
          </Button>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            {xktModelUrl ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-[#1a1a1a] text-sm text-white/70">
                    Loading viewer…
                  </div>
                }
              >
                <div className="h-full w-full [&>div]:rounded-none">
                  <XeokitViewer xktUrl={xktModelUrl} onSelect={setSelected} />
                </div>
              </Suspense>
            ) : modelUrl ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-[#1a1a1a] text-sm text-white/70">
                    Loading viewer…
                  </div>
                }
              >
                <div className="h-full w-full [&>div]:rounded-none">
                  <BimViewer fileUrl={modelUrl} onSelect={setSelected} />
                </div>
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center bg-[#1a1a1a] text-sm text-white/70">
                Preparing model…
              </div>
            )}
          </div>

          {dashboardPreview ? (
            <Suspense
              fallback={
                <aside className="flex w-[360px] shrink-0 items-center justify-center border-l border-[#F0F0F0] bg-[#FAFAFA] text-sm text-gray-400">
                  Loading panel…
                </aside>
              }
            >
              <BimIssueDashboard
                modelName={active.name}
                selected={selected}
                issues={activeIssues}
                assigneeOptions={assigneeOptions}
                issueTitle={issueTitle}
                onIssueTitleChange={setIssueTitle}
                issueAssignee={issueAssignee}
                onIssueAssigneeChange={setIssueAssignee}
                onCreateIssue={addIssue}
                creating={createIssue.isPending}
              />
            </Suspense>
          ) : (
            <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white">
              {selected?.guid ? (
                <div className="flex flex-col">
                  <div className="border-b border-gray-100 px-5 py-4">
                    {selected.ifcType && (
                      <span className="inline-block rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#004DE7]">
                        {selected.ifcType.replace(/^Ifc/, "")}
                      </span>
                    )}
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {selected.name ?? "Unnamed element"}
                    </p>
                    <p className="mt-1 break-all text-[11px] text-gray-400">
                      {selected.guid}
                    </p>
                  </div>

                  <div className="px-5 py-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Properties
                    </p>
                    {selected.properties.length > 0 ? (
                      <dl className="flex flex-col gap-1.5">
                        {selected.properties.map((p) => (
                          <div
                            key={p.label}
                            className="flex justify-between gap-3 text-xs"
                          >
                            <dt className="shrink-0 text-gray-500">{p.label}</dt>
                            <dd
                              className="truncate text-right font-medium text-gray-900"
                              title={p.value}
                            >
                              {p.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-xs text-gray-400">
                        No extra properties on this element.
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="mt-auto border-t border-gray-100 bg-gray-50/60 px-5 py-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Assign this element
                      </p>
                      <input
                        value={issueTitle}
                        onChange={(e) => setIssueTitle(e.target.value)}
                        placeholder={`e.g. Check ${selected.ifcType?.replace(/^Ifc/, "") ?? "element"}`}
                        className="mb-2 h-10 w-full rounded-lg bg-white px-3 text-sm text-gray-900 ring-1 ring-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/30"
                      />
                      <select
                        value={issueAssignee}
                        onChange={(e) => setIssueAssignee(e.target.value)}
                        className="mb-3 h-10 w-full rounded-lg bg-white px-3 text-sm text-gray-900 ring-1 ring-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/30"
                      >
                        <option value="">Select a person…</option>
                        {assigneeOptions.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full"
                        onClick={addIssue}
                        loading={createIssue.isPending}
                        disabled={issueTitle.trim() === ""}
                      >
                        Assign element
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm font-medium text-gray-700">
                    No element selected
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Click a wall, beam, duct or any part of the model to see its
                    details and assign it to a person.
                  </p>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="BIM models"
        description="Import your Revit, ArchiCAD or Navisworks model (via IFC) and view it in 3D. Anchor coordination issues to elements and promote them to RFIs."
        actions={
          // IFC upload temporarily disabled.
          // canUpload ? (
          //   <Button variant="primary" size="md" onClick={() => setUploadOpen(true)}>
          //     <PlusIcon className="size-4" />
          //     Import model
          //   </Button>
          // ) : undefined
          undefined
        }
      />

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : models.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-gray-500">No BIM models yet.</p>
            <p className="mt-1 text-xs text-gray-400">
              Import from Revit, ArchiCAD, Navisworks and more.
            </p>
            {/* IFC upload temporarily disabled.
            {canUpload && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setUploadOpen(true)}
              >
                Import your first model
              </Button>
            )} */}
          </Card>
        ) : (
          models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onOpen={openViewer}
              canOpen={true}
            />
          ))
        )}
      </div>

      {/* IFC upload temporarily disabled.
      <UploadBimDialog open={uploadOpen} onOpenChange={setUploadOpen} projectId={project.id} /> */}
    </div>
  );
}
