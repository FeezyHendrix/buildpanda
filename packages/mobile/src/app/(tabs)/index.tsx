import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Card, Spinner, Text } from "@/components/atoms";
import { CategoryCard } from "@/components/molecules/category-card";
import { Page } from "@/components/molecules/page";
import { SegmentedTabs, type SegmentedTab } from "@/components/molecules/segmented-tabs";
import { WorkspaceSheet } from "@/components/molecules/workspace-sheet";
import { TabletMinWidth } from "@/constants/theme";
import type { Db } from "@/db/client";
import type { DocumentGroup } from "@/db/documents-repository";
import { useLocalDb } from "@/db/provider";
import { useDocumentCategories, useLocalDocuments, useRecentDocuments } from "@/hooks/use-local-documents";
import { useOrganizations, useSetActiveOrganization } from "@/hooks/use-organizations";
import { useProject } from "@/hooks/use-projects";
import { cacheDocument } from "@/lib/download-file";
import { useFieldSession } from "@/lib/field-session";
import { cn } from "@/lib/utils";

/** Two groups, matching the web — no invented Media tab. */
const GROUPS: readonly SegmentedTab<DocumentGroup>[] = [
  { key: "plan", label: "Plans" },
  { key: "document", label: "Documents" },
] as const;

function FileRow({
  doc,
  onOpen,
}: {
  doc: { id: string; fileName: string; size: string; category: string | null; status: string | null; versionNo: number; isAvailableOffline: boolean };
  onOpen: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      onPress={async () => {
        await onOpen(doc.id);
        router.push(`/tools/documents/${doc.id}` as never);
      }}
      accessibilityRole="button"
      className="min-h-16 flex-row items-center gap-3 border-b border-hairline px-4 py-3 active:bg-surface-alt"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
        <Ionicons
          name={
            /\.pdf$/i.test(doc.fileName) ? "document-outline"
            : /\.(xlsx?|csv)$/i.test(doc.fileName) ? "grid-outline"
            : /\.(png|jpe?g|gif|webp|heic)$/i.test(doc.fileName) ? "image-outline"
            : "document-text-outline"
          }
          size={18}
          color="#004DE7"
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
          {doc.fileName}
        </Text>
        <View className="flex-row items-center gap-2 pt-0.5">
          <Text tone="secondary" className="text-xs">
            {[doc.category, doc.size, doc.versionNo > 0 ? `v${doc.versionNo}` : null].filter(Boolean).join(" · ")}
          </Text>
          {doc.status ? (
            <View className={cn(
              "rounded-full px-1.5 py-0.5",
              doc.status === "Verified" ? "bg-success-50" : doc.status === "Expired" ? "bg-error-50" : "bg-surface-alt",
            )}>
              <Text
                weight="semibold"
                tone={doc.status === "Verified" ? "brand" : doc.status === "Expired" ? "danger" : "secondary"}
                className="text-[9px] uppercase"
              >
                {doc.status}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {busy ? (
        <Spinner size="xs" />
      ) : doc.isAvailableOffline ? (
        <Ionicons name="cloud-done-outline" size={18} color="#1AE592" />
      ) : (
        <Ionicons name="cloud-download-outline" size={18} color="#C8C8C8" />
      )}
    </Pressable>
  );
}

function RecentDocs({ db, projectId, onOpen }: { db: Db; projectId: string; onOpen: (id: string) => Promise<void> }) {
  const { data, isPending } = useRecentDocuments(db, projectId);
  if (isPending || data.length === 0) return null;

  return (
    <View className="mb-4">
      <Text weight="bold" className="pb-2 text-base">
        Recently opened
      </Text>
      <Card>
        {data.map((doc) => (
          <FileRow
            key={doc.id}
            doc={doc}
            onOpen={onOpen}
          />
        ))}
      </Card>
    </View>
  );
}

function Browser({ db, projectId, group }: { db: Db; projectId: string; group: DocumentGroup }) {
  const { width } = useWindowDimensions();
  const isWide = width >= TabletMinWidth;
  const [folder, setFolder] = useState<string | null>(null);

  const categories = useDocumentCategories(db, projectId, group);
  const files = useLocalDocuments(db, projectId, group, folder ?? undefined);
  const [error, setError] = useState<string | null>(null);

  if (categories.isPending) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  // Drilled into a folder: show its files with a way back out.
  if (folder) {
    return (
      <>
        <Pressable
          onPress={() => setFolder(null)}
          accessibilityRole="button"
          className="mb-3 min-h-11 flex-row items-center gap-1 self-start"
        >
          <Ionicons name="chevron-back" size={18} color="#004DE7" />
          <Text weight="semibold" tone="brand" className="text-sm">
            All folders
          </Text>
        </Pressable>

        <Text weight="bold" className="pb-2 text-base">
          {folder}
        </Text>

        {error ? (
          <View className="mb-3 rounded-xl bg-error-50 px-4 py-3">
            <Text tone="danger" className="text-sm">
              {error}
            </Text>
          </View>
        ) : null}

        {files.data.length === 0 ? (
          <View className="items-center py-12">
            <Text tone="secondary" className="text-[13px]">
              This folder is empty.
            </Text>
          </View>
        ) : (
          <Card>
            {files.data.map((doc) => (
              <FileRow
                key={doc.id}
                doc={doc}
                onOpen={async (id) => {
                  setError(null);
                  try {
                    await cacheDocument(db, projectId, id);
                  } catch {
                    setError("Couldn't download that file. Try again when you have signal.");
                  }
                }}
              />
            ))}
          </Card>
        )}
      </>
    );
  }

  const openDoc = async (id: string) => {
    const { documentsRepository } = await import("@/db/documents-repository");
    await documentsRepository.trackAccess(db, id);
    try { await cacheDocument(db, projectId, id); } catch {}
  };

  return (
    <>
      <RecentDocs db={db} projectId={projectId} onOpen={openDoc} />

      {categories.data.length === 0 ? (
        <View className="items-center py-12">
          <Text weight="semibold" className="text-center text-base">
            Nothing here yet
          </Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            {group === "plan"
              ? "Drawings uploaded to this project will appear here."
              : "Project documents will appear here."}
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {categories.data.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              isWide={isWide}
              onPress={setFolder}
            />
          ))}
        </View>
      )}
    </>
  );
}

export default function Plans() {
  const { projectId, organizationId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const { data: organizations } = useOrganizations();
  const { data: project } = useProject(projectId);
  const setActive = useSetActiveOrganization();

  const [group, setGroup] = useState<DocumentGroup>("plan");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | undefined>(undefined);

  return (
    <Page
      title="Plans"
      workspaceName={(organizations ?? []).find((o) => o.id === organizationId)?.name}
      projectName={project?.name ?? "Loading project…"}
      onPressWorkspace={() => setSheetOpen(true)}
      onPressProject={() => router.push("/select-project")}
    >
      <View className="pb-3">
        <SegmentedTabs tabs={GROUPS} active={group} onChange={setGroup} />
      </View>

      {ready && db && projectId ? (
        <Browser db={db} projectId={projectId} group={group} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}

      <WorkspaceSheet
        visible={sheetOpen}
        workspaces={(organizations ?? []).map((o) => ({ id: o.id, name: o.name }))}
        activeId={organizationId}
        busyId={switchingId}
        onClose={() => setSheetOpen(false)}
        onSelect={async (id) => {
          if (id === organizationId) {
            setSheetOpen(false);
            return;
          }
          setSwitchingId(id);
          try {
            await setActive.mutateAsync(id);
            router.replace("/");
          } finally {
            setSwitchingId(undefined);
            setSheetOpen(false);
          }
        }}
      />
    </Page>
  );
}
