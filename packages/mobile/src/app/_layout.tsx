import "@/global.css";

import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavColors } from "@/constants/theme";
import { LocalDbProvider } from "@/db/provider";
import { FieldSessionProvider } from "@/lib/field-session";
import { SyncProvider } from "@/lib/sync-provider";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Without an anchor the root stack has no route beneath `capture`, so a reload
// or deep link can surface the capture modal with nothing to go back to.
export const unstable_settings = { initialRouteName: "index" };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // The device is regularly off-network on site; a surfaced failure the
      // user can retry beats a spinner that never resolves.
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <FieldSessionProvider>
          <LocalDbProvider>
          <SyncProvider>
          <StatusBar style="light" />
          <Stack
            initialRouteName="index"
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: NavColors.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="capture" options={{ presentation: "modal" }} />
          </Stack>
          </SyncProvider>
          </LocalDbProvider>
        </FieldSessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export { ErrorBoundary } from "expo-router";
