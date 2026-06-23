import type { ChatMessage } from "@/lib/project-types";

const DB_NAME = "buildpanda-chat";
const DB_VERSION = 1;
const MESSAGE_STORE = "messages";
const DRAFT_STORE = "drafts";
const MAX_MESSAGES_PER_CHANNEL = 200;

interface CachedMessage extends ChatMessage {
  cachedChannelId: string;
  cachedAt: string;
}

interface CachedDraft {
  key: string;
  channelId: string;
  parentMessageId: string | null;
  text: string;
  updatedAt: string;
}

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function openChatDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error("IndexedDB is not available"));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        const messages = db.createObjectStore(MESSAGE_STORE, { keyPath: "id" });
        messages.createIndex("channel", "cachedChannelId", { unique: false });
      }
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        const drafts = db.createObjectStore(DRAFT_STORE, { keyPath: "key" });
        drafts.createIndex("channel", "channelId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open chat cache"));
  });
}

function draftKey(channelId: string, parentMessageId?: string): string {
  return `${channelId}:${parentMessageId ?? "root"}`;
}

export async function readCachedMessages(channelId: string): Promise<ChatMessage[]> {
  try {
    const db = await openChatDb();
    const transaction = db.transaction(MESSAGE_STORE, "readonly");
    const store = transaction.objectStore(MESSAGE_STORE);
    const index = store.index("channel");
    const rows = await requestToPromise<CachedMessage[]>(
      index.getAll(IDBKeyRange.only(channelId)),
    );
    db.close();
    return rows
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-MAX_MESSAGES_PER_CHANNEL)
      .map(({ cachedAt: _cachedAt, cachedChannelId: _cachedChannelId, ...message }) => message);
  } catch {
    return [];
  }
}

export async function cacheMessages(channelId: string, messages: ChatMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const db = await openChatDb();
    const transaction = db.transaction(MESSAGE_STORE, "readwrite");
    const store = transaction.objectStore(MESSAGE_STORE);
    const cachedAt = new Date().toISOString();
    for (const message of messages) {
      store.put({ ...message, cachedChannelId: channelId, cachedAt } satisfies CachedMessage);
    }
    await requestToPromise(transaction.objectStore(MESSAGE_STORE).get(messages[0]!.id));
    db.close();
  } catch {
    // Cache writes are best-effort; chat must keep working if IndexedDB is blocked.
  }
}

export async function deleteCachedMessage(messageId: string): Promise<void> {
  try {
    const db = await openChatDb();
    const transaction = db.transaction(MESSAGE_STORE, "readwrite");
    transaction.objectStore(MESSAGE_STORE).delete(messageId);
    await requestToPromise(transaction.objectStore(MESSAGE_STORE).get(messageId));
    db.close();
  } catch {
    // Best-effort cache cleanup.
  }
}

export async function readCachedDraft(
  channelId: string,
  parentMessageId?: string,
): Promise<string> {
  try {
    const db = await openChatDb();
    const transaction = db.transaction(DRAFT_STORE, "readonly");
    const row = await requestToPromise<CachedDraft | undefined>(
      transaction.objectStore(DRAFT_STORE).get(draftKey(channelId, parentMessageId)),
    );
    db.close();
    return row?.text ?? "";
  } catch {
    return "";
  }
}

export async function saveCachedDraft(
  channelId: string,
  parentMessageId: string | undefined,
  text: string,
): Promise<void> {
  try {
    const db = await openChatDb();
    const transaction = db.transaction(DRAFT_STORE, "readwrite");
    const key = draftKey(channelId, parentMessageId);
    if (text.trim()) {
      transaction.objectStore(DRAFT_STORE).put({
        key,
        channelId,
        parentMessageId: parentMessageId ?? null,
        text,
        updatedAt: new Date().toISOString(),
      } satisfies CachedDraft);
    } else {
      transaction.objectStore(DRAFT_STORE).delete(key);
    }
    await requestToPromise(transaction.objectStore(DRAFT_STORE).get(key));
    db.close();
  } catch {
    // Draft persistence is best-effort.
  }
}

export async function clearCachedDraft(
  channelId: string,
  parentMessageId?: string,
): Promise<void> {
  await saveCachedDraft(channelId, parentMessageId, "");
}
