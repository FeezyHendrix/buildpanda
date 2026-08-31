import { useState } from "react";
import { router } from "expo-router";
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Field, Text } from "@/components/atoms";
import { authClient } from "@/lib/auth-client";
import logo from "@/assets/images/buildpanda-logo.png";

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    // Same endpoint the web app posts to; the Expo plugin stores the returned
    // session cookie in the keychain. The gate lives on `/`, so hand back to it
    // rather than routing from here — it decides workspace vs project vs tools.
    await authClient.signIn.email(
      { email: email.trim(), password },
      {
        onSuccess: () => router.replace("/"),
        onError: (ctx) => {
          setLoading(false);
          setError(ctx.error.message ?? "Invalid email or password.");
        },
      },
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="px-6"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-[520px] self-center">
          <Image
            source={logo}
            accessibilityLabel="BuildPanda"
            resizeMode="contain"
            className="h-9 w-[99px]"
          />

          <View className="pt-8">
            <Text weight="bold" className="text-2xl">
              Field Tools
            </Text>
            <Text tone="secondary" className="pt-1 text-[15px]">
              Sign in to record work from site.
            </Text>
          </View>

          {error ? (
            <View className="mt-6 rounded-xl bg-error-50 px-4 py-3" accessibilityLiveRegion="polite">
              <Text tone="danger" className="text-sm">
                {error}
              </Text>
            </View>
          ) : null}

          <View className="gap-5 pt-8">
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="next"
            />

            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />

            <Button onPress={handleSubmit} disabled={!canSubmit} loading={loading}>
              Sign In
            </Button>
          </View>

          <Text tone="muted" className="pt-8 text-center text-xs leading-5">
            Field Tools accounts are created by your project manager. Ask them for an invite if you
            can&apos;t sign in.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
