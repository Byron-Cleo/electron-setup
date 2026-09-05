import { BrowserWindow } from "electron";
import { getApiOrigin } from "./server-config.ts";

// Bridges the backend SSE stream (/api/events) into the renderer. The renderer
// does not open its own EventSource because in production all requests go
// through the main-process origin (server-config.json), and a direct connection
// would break CSP/origin resolution. Each event is forwarded to every window as
// `live:event`. Reconnects with exponential backoff on failure.
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;
let closing = false;
let backoffMs = 1_000;

export function startLiveEvents(): void {
  void connect();
}

export function stopLiveEvents(): void {
  closing = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  controller?.abort();
}

async function connect(): Promise<void> {
  if (closing) return;

  const origin = getApiOrigin();
  const url = `${origin}/api/events`;
  controller = new AbortController();

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }

    backoffMs = 1_000;
    console.log(`[live-events] Connected to ${url}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (!closing) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const dataLine = frame
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue; // skip comments/pings
        const payload = dataLine.slice(5).trim();
        if (!payload) continue;
        try {
          broadcast(JSON.parse(payload));
        } catch (err) {
          console.error("[live-events] Failed to parse event:", err);
        }
      }
    }
  } catch (err) {
    console.warn(`[live-events] Disconnected (${(err as Error)?.message ?? err}). Reconnecting in ${backoffMs}ms`);
  } finally {
    if (!closing) {
      reconnectTimer = setTimeout(() => void connect(), backoffMs);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    }
  }
}

function broadcast(event: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("live:event", event);
    }
  }
}