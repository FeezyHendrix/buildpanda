import { Text } from "@/components/atoms/text";
import { useContentImageResolver } from "@/hooks/use-content-image";
import { EnrichedEditor, type RichTextEditorProps } from "./enriched-editor";
import { enrichedAvailable } from "./enriched-runtime";

export type { RichTextEditorProps } from "./enriched-editor";

/** Screens consume this adapter; Enriched and file resolution stay internal. */
export function RichTextEditor(props: RichTextEditorProps) {
  const scope = useContentImageResolver(props.projectId);
  if (!scope.ready) return null;
  if (!enrichedAvailable) return <Text tone="secondary">Open the current BuildPanda development build to edit formatted text.</Text>;
  return <EnrichedEditor key={`${scope.projectId}:${scope.version}`} {...props} projectId={scope.projectId} />;
}
