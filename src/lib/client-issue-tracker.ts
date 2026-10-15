"use client";

export type ClientEventType =
  | "runtime_error"
  | "unhandled_rejection"
  | "connection_lost"
  | "connection_restored"
  | "ai_generation_failed"
  | "ai_generation_succeeded"
  | "session_started"
  | "page_view";

type QueuedEvent = {
  eventType: ClientEventType;
  errorCode: string | null;
  route: string;
  queuedAt: number;
};

const queueKey = "devis-ia:client-events";
const recentKey = "devis-ia:client-events:recent";
const maxQueuedEvents = 50;
const dedupeWindowMs = 60_000;
const allowedEventTypes = new Set<ClientEventType>([
  "runtime_error",
  "unhandled_rejection",
  "connection_lost",
  "connection_restored",
  "ai_generation_failed",
  "ai_generation_succeeded",
  "session_started",
  "page_view",
]);
const safeErrorCodes = new Set([
  "Error",
  "TypeError",
  "ReferenceError",
  "RangeError",
  "SyntaxError",
  "NetworkError",
  "AbortError",
  "TimeoutError",
  "FetchError",
  "AuthError",
  "RuntimeError",
  "UnhandledRejection",
  "AI_SERVER_FAILURE",
  "AI_REQUEST_FAILURE",
]);

function currentRoute() {
  return `${window.location.pathname}`.slice(0, 120);
}

function queueStorageKey(userId: string) {
  return `${queueKey}:${userId}`;
}

function recentStorageKey(userId: string) {
  return `${recentKey}:${userId}`;
}

function readQueue(userId: string): QueuedEvent[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(queueStorageKey(userId)) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is QueuedEvent =>
        typeof entry === "object" &&
        entry !== null &&
        "eventType" in entry &&
        typeof entry.eventType === "string" &&
        allowedEventTypes.has(entry.eventType as ClientEventType) &&
        "errorCode" in entry &&
        (entry.errorCode === null ||
          (typeof entry.errorCode === "string" && safeErrorCodes.has(entry.errorCode))) &&
        "route" in entry &&
        typeof entry.route === "string" &&
        entry.route.startsWith("/") &&
        entry.route.length <= 120 &&
        !entry.route.includes("?") &&
        "queuedAt" in entry &&
        typeof entry.queuedAt === "number" &&
        Number.isFinite(entry.queuedAt)
    );
  } catch {
    return [];
  }
}

function writeQueue(userId: string, queue: QueuedEvent[]) {
  try {
    window.localStorage.setItem(
      queueStorageKey(userId),
      JSON.stringify(queue.slice(-maxQueuedEvents))
    );
  } catch {
    // Telemetry must not break application use when browser storage is unavailable.
  }
}

function wasRecentlySent(userId: string, event: QueuedEvent) {
  try {
    const recent: Record<string, number> = JSON.parse(
      window.localStorage.getItem(recentStorageKey(userId)) || "{}"
    );
    const key = `${event.eventType}:${event.route}`;
    const now = Date.now();
    if (now - (recent[key] || 0) < dedupeWindowMs) return true;
    recent[key] = now;
    window.localStorage.setItem(recentStorageKey(userId), JSON.stringify(recent));
    return false;
  } catch {
    return false;
  }
}

async function send(event: QueuedEvent) {
  const response = await fetch("/api/client-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: event.eventType,
      errorCode: event.errorCode,
      route: event.route,
    }),
    keepalive: true,
  });
  if (!response.ok) throw new Error("Client event was not accepted.");
}

export function discardOtherUsersEvents(userId: string) {
  if (typeof window === "undefined") return;
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (
        key &&
        (key.startsWith(`${queueKey}:`) || key.startsWith(`${recentKey}:`)) &&
        !key.endsWith(`:${userId}`)
      ) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Telemetry cleanup must not block the application when browser storage is unavailable.
  }
}

export function reportClientEvent(userId: string, eventType: ClientEventType, errorCode?: string) {
  if (typeof window === "undefined" || !userId) return;
  const safeErrorCode = errorCode && safeErrorCodes.has(errorCode) ? errorCode : null;
  const event = {
    eventType,
    errorCode: safeErrorCode,
    route: currentRoute(),
    queuedAt: Date.now(),
  };
  if (eventType !== "page_view" && wasRecentlySent(userId, event)) return;

  if (!navigator.onLine) {
    writeQueue(userId, [...readQueue(userId), event]);
    return;
  }

  void send(event).catch(() => writeQueue(userId, [...readQueue(userId), event]));
}

export async function flushClientEvents(userId: string) {
  if (typeof window === "undefined" || !navigator.onLine || !userId) return;
  const queue = readQueue(userId);
  const remaining: QueuedEvent[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    try {
      await send(queue[index]);
    } catch {
      remaining.push(...queue.slice(index));
      break;
    }
  }
  writeQueue(userId, remaining);
}
