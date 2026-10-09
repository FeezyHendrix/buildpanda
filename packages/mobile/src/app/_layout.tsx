import "@/global.css";

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
import { OfflinePlansProvider } from "@/lib/offline-plans-provider";
import { StageScopeProvider } from "@/lib/stage-scope";

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
    Archivo_700Bold: require("../../assets/fonts/Archivo_700Bold.ttf"),
    Archivo_600SemiBold: require("../../assets/fonts/Archivo_600SemiBold.ttf"),
    Inter_400Regular: require("../../assets/fonts/Inter_400Regular.ttf"),
    Inter_500Medium: require("../../assets/fonts/Inter_500Medium.ttf"),
    Inter_600SemiBold: require("../../assets/fonts/Inter_600SemiBold.ttf"),
    Inter_700Bold: require("../../assets/fonts/Inter_700Bold.ttf"),
    Inter_800ExtraBold: require("../../assets/fonts/Inter_800ExtraBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <FieldSessionProvider>
          <StageScopeProvider>
          <LocalDbProvider>
          <SyncProvider>
          <OfflinePlansProvider>
          <StatusBar style="dark" />
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
          </OfflinePlansProvider>
          </SyncProvider>
          </LocalDbProvider>
          </StageScopeProvider>
        </FieldSessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export { ErrorBoundary } from "expo-router";
