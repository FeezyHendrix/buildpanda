import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Card, Spinner, Text } from "@/components/atoms";
import { CategoryCard } from "@/components/molecules/category-card";
import { DocumentFileRow } from "@/components/molecules/document-file-row";
import { Page } from "@/components/molecules/page";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { SegmentedTabs, type SegmentedTab } from "@/components/molecules/segmented-tabs";
import { WorkspaceSheet } from "@/components/molecules/workspace-sheet";
import { ICON_BRAND } from "@/constants/colors";
import { TabletMinWidth } from "@/constants/theme";
import type { Db } from "@/db/client";
import { DOCUMENT_GROUP, documentsRepository, type DocumentGroup } from "@/db/documents-repository";
import { useLocalDb } from "@/db/provider";
import { useDocumentCategories, useLocalDocuments, useRecentDocuments } from "@/hooks/use-local-documents";
import { useOrganizations, useSetActiveOrganization } from "@/hooks/use-organizations";
import { useProject } from "@/hooks/use-projects";
import { cacheDocument } from "@/lib/download-file";
import { useFieldSession } from "@/lib/field-session";

// The web's Plans and Documents pages, as two tabs. Media has its own library
// on the web and is not shown here at all — never folded into Documents.
const GROUPS: readonly SegmentedTab<DocumentGroup>[] = [
  { key: DOCUMENT_GROUP.PLAN, label: "Plans" },
  { key: DOCUMENT_GROUP.DOCUMENT, label: "Documents" },
] as const;

interface Folder {
  id: string;
  name: string;
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
          <DocumentFileRow key={doc.id} doc={doc} onOpen={onOpen} />
        ))}
      </Card>
    </View>
  );
}

function Browser({ db, projectId, group }: { db: Db; projectId: string; group: DocumentGroup }) {
  const { width } = useWindowDimensions();
  const isWide = width >= TabletMinWidth;
  const [folder, setFolder] = useState<Folder | null>(null);

  const categories = useDocumentCategories(db, projectId, group);
  // filtered by category id: two folders in different groups may share a name
  const files = useLocalDocuments(db, projectId, group, folder?.id);
  const [error, setError] = useState<string | null>(null);

  if (categories.isPending) {
    return (
      <View className="items-center py-12">
        <Spinner size="md" />
      </View>
    );
  }

  const openDoc = async (id: string) => {
    setError(null);
    await documentsRepository.trackAccess(db, id);
    try {
      await cacheDocument(db, projectId, id);
    } catch (err) {
      console.error("document download failed", err);
      setError(
        err instanceof Error && err.message
          ? `Couldn't download that file: ${err.message}`
          : "Couldn't download that file. Try again when you have signal.",
      );
    }
  };

  // Drilled into a folder: show its files with a way back out.
  if (folder) {
    return (
      <>
        <Pressable
          onPress={() => setFolder(null)}
          accessibilityRole="button"
          className="mb-3 min-h-11 flex-row items-center gap-1 self-start"
        >
          <Ionicons name="chevron-back" size={18} color={ICON_BRAND} />
          <Text weight="semibold" tone="brand" className="text-sm">
            All folders
          </Text>
        </Pressable>

        <Text weight="bold" className="pb-2 text-base">
          {folder.name}
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
            <Text weight="semibold" className="text-center text-base">
              This folder is empty
            </Text>
            <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
              {group === DOCUMENT_GROUP.PLAN
                ? "Upload a drawing with the cloud button above and it is filed here."
                : "Upload a document with the cloud button above and it is filed here."}
            </Text>
          </View>
        ) : (
          <Card>
            {files.data.map((doc) => (
              <DocumentFileRow key={doc.id} doc={doc} onOpen={openDoc} />
            ))}
          </Card>
        )}
      </>
    );
  }

  return (
    <>
      {error ? (
        <View className="mb-3 rounded-xl bg-error-50 px-4 py-3">
          <Text tone="danger" className="text-sm">
            {error}
          </Text>
        </View>
      ) : null}

      <RecentDocs db={db} projectId={projectId} onOpen={openDoc} />

      {categories.data.length === 0 ? (
        <View className="items-center py-12">
          <Text weight="semibold" className="text-center text-base">
            {group === DOCUMENT_GROUP.PLAN ? "No plans yet" : "No documents yet"}
          </Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            {group === DOCUMENT_GROUP.PLAN
              ? "Upload a drawing with the cloud button above, or open this project once with signal to fetch its folders."
              : "Upload a document with the cloud button above, or open this project once with signal to fetch its folders."}
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {categories.data.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              isWide={isWide}
              onPress={() => setFolder({ id: category.id, name: category.name })}
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

  const [group, setGroup] = useState<DocumentGroup>(DOCUMENT_GROUP.PLAN);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | undefined>(undefined);
  const isPlans = group === DOCUMENT_GROUP.PLAN;

  return (
    <Page
      title={isPlans ? "Plans" : "Documents"}
      rightButtons={
        <HeaderIconButton
          icon="cloud-upload-outline"
          label={isPlans ? "Upload a plan" : "Upload a document"}
          onPress={() => router.push(`/tools/documents/upload?group=${group}` as never)}
        />
      }
      workspaceName={(organizations ?? []).find((o) => o.id === organizationId)?.name}
      projectName={project?.name}
      projectPending={Boolean(projectId) && !project}
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
