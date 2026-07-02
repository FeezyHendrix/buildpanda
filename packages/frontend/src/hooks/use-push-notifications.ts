import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

// Keys live here (not in query-keys.ts) to keep this feature's footprint to
// the files it owns; both derive from the shared "notifications" root.
const pushKeys = {
  publicKey: ["notifications", "push", "public-key"] as const,
  subscription: ["notifications", "push", "subscription"] as const,
};

export function isPushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Web Push expects the VAPID public key as a Uint8Array, but the server hands
// it out URL-safe base64 encoded.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export interface PushNotificationsState {
  /** Browser supports service workers + Push API. */
  supported: boolean;
  /** Server has VAPID keys configured (public key is non-empty). */
  configured: boolean;
  /** This device currently has an active push subscription. */
  enabled: boolean;
  /** The user has blocked notifications at the browser level. */
  permissionDenied: boolean;
  isLoading: boolean;
  isPending: boolean;
  error: string | null;
  enable: () => void;
  disable: () => void;
}

export function usePushNotifications(): PushNotificationsState {
  const supported = isPushSupported();
  const queryClient = useQueryClient();

  const publicKeyQuery = useQuery({
    queryKey: pushKeys.publicKey,
    queryFn: async () => {
      const { data } = await api.get<{ publicKey: string }>("/push/public-key");
      return data.publicKey;
    },
    enabled: supported,
    staleTime: Infinity,
  });

  const subscriptionQuery = useQuery({
    queryKey: pushKeys.subscription,
    queryFn: async () => {
      const subscription = await getCurrentSubscription();
      return subscription?.endpoint ?? null;
    },
    enabled: supported,
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      const publicKey = publicKeyQuery.data;
      if (!publicKey) throw new Error("Push notifications are not configured.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(
          "Notifications are blocked for this site. Allow them in your browser settings, then try again.",
        );
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("The browser returned an incomplete push subscription.");
      }
      await api.post("/push/subscriptions", {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: pushKeys.subscription });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const subscription = await getCurrentSubscription();
      if (!subscription) return;
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.delete("/push/subscriptions", { data: { endpoint } });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: pushKeys.subscription });
    },
  });

  const mutationError = enableMutation.error ?? disableMutation.error;

  return {
    supported,
    configured: Boolean(publicKeyQuery.data),
    enabled: Boolean(subscriptionQuery.data),
    permissionDenied: supported && Notification.permission === "denied",
    isLoading: supported && (publicKeyQuery.isLoading || subscriptionQuery.isLoading),
    isPending: enableMutation.isPending || disableMutation.isPending,
    error: mutationError ? mutationError.message : null,
    enable: () => enableMutation.mutate(),
    disable: () => disableMutation.mutate(),
  };
}
