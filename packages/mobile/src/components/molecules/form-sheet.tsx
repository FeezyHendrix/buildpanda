import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Text } from "@/components/atoms";

interface FormSheetProps {
  visible: boolean;
  title: string;
  /** Present when editing; drives the submit label the way the web dialogs do. */
  isEdit?: boolean;
  submitLabel?: string;
  canSubmit?: boolean;
  loading?: boolean;
  error?: string | null;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * One sheet for create and edit, mirroring the web's single upsert dialog per
 * feature rather than a separate screen for each verb.
 */
export function FormSheet({
  visible,
  title,
  isEdit = false,
  submitLabel,
  canSubmit = true,
  loading = false,
  error,
  onSubmit,
  onClose,
  children,
}: FormSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable onPress={onClose} accessibilityLabel="Dismiss" className="flex-1 bg-black-900/40" />

        <View className="max-h-[88%] rounded-t-3xl bg-surface" style={{ paddingBottom: insets.bottom + 12 }}>
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-full bg-grey-100" />
          </View>

          <View className="flex-row items-center px-5 pb-2 pt-4">
            <Text weight="bold" className="flex-1 text-lg">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-alt"
            >
              <Ionicons name="close" size={20} color="#717171" />
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            contentContainerClassName="gap-4 pb-4"
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <View className="rounded-xl bg-error-50 px-4 py-3">
                <Text tone="danger" className="text-sm">
                  {error}
                </Text>
              </View>
            ) : null}

            {children}
          </ScrollView>

          <View className="px-5 pt-2">
            <Button onPress={onSubmit} disabled={!canSubmit} loading={loading}>
              {submitLabel ?? (isEdit ? "Save changes" : "Create")}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

FormSheet.displayName = "FormSheet";

export type { FormSheetProps };
