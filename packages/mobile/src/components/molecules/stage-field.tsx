import { useState } from "react";
import { Pressable, View } from "react-native";
import { FieldLabel, Text } from "@/components/atoms";
import { useStageScope } from "@/lib/stage-scope";
import { WorkspaceSheet } from "./workspace-sheet";

export function StageField({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { stages, canView, isLoading } = useStageScope();
  const [open, setOpen] = useState(false);
  if (!canView) return null;
  const label = stages.find((stage) => stage.id === value)?.name ?? (value ? "Selected build stage" : "No build stage");
  return (
    <View className="gap-2">
      <FieldLabel>Build stage</FieldLabel>
      <Pressable accessibilityRole="button" accessibilityLabel={`Assign build stage: ${label}`} onPress={() => setOpen(true)} className="min-h-14 justify-center rounded-xl border border-line bg-surface px-4">
        <Text className="text-sm">{label}</Text>
      </Pressable>
      <WorkspaceSheet visible={open} title="Assign build stage" loading={isLoading}
        workspaces={[{ id: "", name: "No build stage" }, ...stages]} activeId={value ?? ""}
        onSelect={(id) => { onChange(id || null); setOpen(false); }} onClose={() => setOpen(false)} />
    </View>
  );
}
