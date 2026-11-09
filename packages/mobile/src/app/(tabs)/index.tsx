import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Spinner, Text } from "@/components/atoms";
import { DocumentFileRow } from "@/components/molecules/document-file-row";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { OfflinePlansStatus } from "@/components/molecules/offline-plans-status";
import { Page } from "@/components/molecules/page";
import { SearchableList } from "@/components/molecules/searchable-list";
import type { Db } from "@/db/client";
import { documentsRepository, type LocalDocument } from "@/db/documents-repository";
import { useLocalDb } from "@/db/provider";
import { useLocalDocuments } from "@/hooks/use-local-documents";
import { useOrganizations } from "@/hooks/use-organizations";
import { useProject } from "@/hooks/use-projects";
import { cacheDocument } from "@/lib/download-file";
import { useFieldSession } from "@/lib/field-session";

const searchFields = (file: LocalDocument) => [file.fileName, file.status];

function FileList({ db, projectId }: { db: Db; projectId: string }) {
  const files = useLocalDocuments(db, projectId);
  const [error, setError] = useState<string | null>(null);
  const openFile = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await cacheDocument(db, projectId, id);
        await documentsRepository.trackAccess(db, id);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn't open this file. Try again.");
        throw cause;
      }
    },
    [db, projectId],
  );
  return (
    <SearchableList
      data={files.data}
      fields={searchFields}
      loading={files.isPending}
      placeholder="Search files"
      emptyTitle="No files yet"
      emptyBody="Add a file with the + button. Your project's files appear here."
      renderItem={(file) => <DocumentFileRow doc={file} onOpen={openFile} />}
      header={
        <>
          {error || files.error ? (
            <Text tone="danger" className="pb-3 text-sm">
              {error ?? files.error?.message}
            </Text>
          ) : null}
          <OfflinePlansStatus />
        </>
      }
    />
  );
}

export default function Files() {
  const { projectId, organizationId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const { data: organizations } = useOrganizations();
  const { data: project } = useProject(projectId);
  return (
    <Page
      title="Files"
      scroll={false}
      workspaceName={
        (organizations ?? []).find((organization) => organization.id === organizationId)?.name
      }
      projectName={project?.name}
      projectPending={Boolean(projectId) && !project}
      onPressProject={() => router.push("/select-project")}
      rightButtons={
        <HeaderIconButton
          icon="add"
          label="Add file"
          disabled={!ready || !projectId}
          onPress={() => router.push("/tools/documents/upload")}
        />
      }
    >
      {ready && db && projectId ? (
        <FileList key={projectId} db={db} projectId={projectId} />
      ) : (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      )}
    </Page>
  );
}
