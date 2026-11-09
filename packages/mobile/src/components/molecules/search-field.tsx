import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, TextInput, View } from "react-native";
import { ICON_MUTED, ICON_SUBTLE } from "@/constants/colors";

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View className="mb-4 min-h-14 flex-row items-center gap-2 rounded-xl bg-surface-alt pl-4 pr-2">
      <Ionicons name="search" size={18} color={ICON_MUTED} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        placeholderTextColor={ICON_SUBTLE}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="min-h-14 min-w-0 flex-1 font-jakarta text-base text-black-500"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChange("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-hairline"
        >
          <Ionicons name="close-circle" size={18} color={ICON_SUBTLE} />
        </Pressable>
      ) : null}
    </View>
  );
}
