import { EventEmitter } from "events";
import type { Express } from "express";

export interface LiveEvent {
  type: string;
  orderId?: string;
  shiftId?: string;
  at?: string;
}

const emitter = new EventEmitter();

export function emitLiveEvent(event: LiveEvent): void {
  emitter.emit("live", event);
}

const HEARTBEAT_MS = 25_000;

// Server-Sent Events endpoint. Every connected client (Electron terminal via the
// main-process bridge, or a browser over WiFi) receives domain events such as
// order.created / order.paid / order.voided / shift.opened / shift.closed.
// Unauthenticated on purpose — same LAN trust model as the REST API.
export function registerEventsRoute(app: Express): void {
  app.get("/api/events", (_req, res) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (event: LiveEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    emitter.on("live", send);

    const heartbeat = setInterval(() => {
      res.write(": ping\n\n");
    }, HEARTBEAT_MS);

    res.on("close", () => {
      clearInterval(heartbeat);
      emitter.off("live", send);
    });

    res.write(": connected\n\n");
  });
}