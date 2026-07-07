import api from "./client";

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface SubscribePushInput {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

export interface UnsubscribePushInput {
  endpoint: string;
}

export const pushNotificationsApi = {
  publicKey: () => api.get<{ publicKey: string }>("/push/public-key").then((r) => r.data),
  
  subscribe: (input: SubscribePushInput) => api.post("/push/subscriptions", input).then((r) => r.data),
  
  unsubscribe: (input: UnsubscribePushInput) => api.delete("/push/subscriptions", { data: input }).then((r) => r.data),
};
