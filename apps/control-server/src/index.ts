import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { makeDedupeKey, parseBridgeEventJson, resolveStreamProfile, type BridgeEvent, type StreamProfileName } from "@vrcbb/protocol";
import { BrowserController } from "./browserController.js";
import { createStaticHandler, sendJson } from "./staticServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const controlLockTtlMs = 30_000;
const controlMode = process.env.CONTROL_MODE === "locked" ? "locked" : "open";

const port = parseInteger(process.env.PORT, 8787);
const viewportWidth = parseInteger(process.env.BROWSER_WIDTH, 1280);
const viewportHeight = parseInteger(process.env.BROWSER_HEIGHT, 720);
const startUrl = process.env.START_URL ?? "https://example.com";
const headless = process.env.HEADLESS === "1";
const mockRoot = resolve(__dirname, "../../mock-input/public");

const browser = new BrowserController({
  width: viewportWidth,
  height: viewportHeight,
  startUrl,
  headless
});

const seenEvents = new Set<string>();
const lastSeqBySource = new Map<string, number>();
const clients = new Set<WebSocket>();
const staticHandler = createStaticHandler(mockRoot);
let controlLock: ControlLock | undefined;
let streamProfile: StreamProfileName = "720p";
let mediaEventId = 0;
const mediaEvents: MediaControlEvent[] = [];

interface ControlLock {
  playerId: string;
  playerName: string;
  source: string;
  expiresAt: number;
}

interface MediaControlEvent {
  id: number;
  type: "stream_profile";
  profile: StreamProfileName;
  width: number;
  height: number;
  mediaWidth: number;
  createdAt: number;
}

const server = createServer(async (request, response) => {
  if (request.url?.startsWith("/health")) {
    sendJson(response, 200, {
      ok: true,
      clients: clients.size,
      browser: browser.getState(),
      controlMode,
      controlLock: currentLock(),
      viewport: {
        width: viewportWidth,
        height: viewportHeight
      },
      media: mediaState()
    });
    return;
  }

  if (request.url?.startsWith("/media-state")) {
    sendJson(response, 200, {
      ok: true,
      media: mediaState(),
      browser: browser.getState()
    });
    return;
  }

  if (request.url?.startsWith("/media-control/events")) {
    const url = new URL(request.url, "http://127.0.0.1");
    const since = Number.parseInt(url.searchParams.get("since") ?? "0", 10);
    sendJson(response, 200, {
      ok: true,
      events: mediaEvents.filter((event) => event.id > since).slice(-20),
      media: mediaState()
    });
    return;
  }

  if (request.url?.startsWith("/snapshot")) {
    try {
      sendJson(response, 200, {
        ok: true,
        image: await browser.screenshotBase64(),
        browser: browser.getState()
      });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Snapshot failed"
      });
    }
    return;
  }

  await staticHandler(request, response);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  clients.add(socket);
  send(socket, {
    type: "server_hello",
    v: 1,
    browser: browser.getState(),
    controlMode,
    controlLock: currentLock(),
    viewport: {
      width: viewportWidth,
      height: viewportHeight
    },
    media: mediaState()
  });

  socket.on("message", (message) => {
    void handleMessage(socket, message.toString());
  });

  socket.on("close", () => {
    clients.delete(socket);
  });
});

await browser.start();

server.listen(port, "127.0.0.1", () => {
  console.log(`VRC Browser Bridge control server listening on http://127.0.0.1:${port}`);
  console.log(`WebSocket endpoint ws://127.0.0.1:${port}`);
  console.log(`Browser viewport ${viewportWidth}x${viewportHeight}, start URL ${startUrl}`);
});

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

async function handleMessage(socket: WebSocket, rawMessage: string): Promise<void> {
  const receivedAt = Date.now();
  const parsed = parseBridgeEventJson(rawMessage);
  if (!parsed.ok) {
    send(socket, {
      type: "event_rejected",
      error: parsed.error
    });
    return;
  }

  const event = withDefaults(parsed.value);
  expireLock();
  const dedupeKey = makeDedupeKey(event);
  if (seenEvents.has(dedupeKey)) {
    send(socket, {
      type: "event_duplicate",
      seq: event.seq
    });
    return;
  }

  const seqKey = seqKeyFor(event);
  const lastSeq = lastSeqBySource.get(seqKey);
  if (lastSeq !== undefined && event.seq <= lastSeq) {
    send(socket, {
      type: "event_rejected",
      seq: event.seq,
      error: `Out-of-order seq; last accepted seq is ${lastSeq}`
    });
    return;
  }

  if (event.type === "lock_request") {
    controlLock = {
      playerId: event.playerId ?? "anonymous",
      playerName: event.playerName ?? event.playerId ?? "未知玩家",
      source: event.source ?? "unknown",
      expiresAt: Date.now() + controlLockTtlMs
    };
    seenEvents.add(dedupeKey);
    lastSeqBySource.set(seqKey, event.seq);
    broadcastState();
    broadcast({
      type: "event_applied",
      event,
      result: "lock_acquired",
      rttMs: Date.now() - receivedAt
    });
    return;
  }

  if (event.type === "lock_release") {
    const lock = currentLock();
    if (lock && lock.playerId !== event.playerId) {
      send(socket, {
        type: "event_rejected",
        seq: event.seq,
        code: "LOCK_HELD_BY_OTHER",
        error: `Control is held by ${lock.playerName}`
      });
      return;
    }

    controlLock = undefined;
    seenEvents.add(dedupeKey);
    lastSeqBySource.set(seqKey, event.seq);
    broadcastState();
    broadcast({
      type: "event_applied",
      event,
      result: "lock_released",
      rttMs: Date.now() - receivedAt
    });
    return;
  }

  if (controlMode === "locked" && requiresControlLock(event)) {
    const lock = currentLock();
    if (!lock || lock.playerId !== event.playerId) {
      send(socket, {
        type: "event_rejected",
        seq: event.seq,
        code: lock ? "LOCK_HELD_BY_OTHER" : "LOCK_REQUIRED",
        controlLock: lock,
        error: lock ? `Control is held by ${lock.playerName}` : "Control lock is required"
      });
      return;
    }

    controlLock = {
      ...lock,
      expiresAt: Date.now() + controlLockTtlMs
    };
  }

  try {
    await browser.applyEvent(event);
    if (event.type === "stream_profile") {
      streamProfile = event.profile;
      enqueueMediaEvent(event.profile);
    }
    seenEvents.add(dedupeKey);
    lastSeqBySource.set(seqKey, event.seq);
    broadcast({
      type: "event_applied",
      event,
      browser: browser.getState(),
      controlLock: currentLock(),
      rttMs: Date.now() - receivedAt
    });
    broadcastState();
  } catch (error) {
    send(socket, {
      type: "event_failed",
      seq: event.seq,
      code: "BROWSER_ERROR",
      error: error instanceof Error ? error.message : "Event failed"
    });
  }
}

function withDefaults(event: BridgeEvent): BridgeEvent {
  return {
    ...event,
    playerId: event.playerId ?? "mock-player",
    source: event.source ?? "mock",
    ts: event.ts ?? Date.now()
  };
}

function broadcast(payload: unknown): void {
  for (const client of clients) {
    send(client, payload);
  }
}

function broadcastState(): void {
  broadcast({
    type: "server_state",
    controlMode,
    browser: browser.getState(),
    controlLock: currentLock(),
    clients: clients.size,
    media: {
      ...mediaState(),
      status: "control-ready"
    }
  });
}

function currentLock(): ControlLock | undefined {
  expireLock();
  return controlLock;
}

function expireLock(): void {
  if (controlLock && controlLock.expiresAt <= Date.now()) {
    controlLock = undefined;
  }
}

function requiresControlLock(event: BridgeEvent): boolean {
  return [
    "pointer_move",
    "pointer_down",
    "pointer_up",
    "wheel",
    "text_commit",
    "key_press",
    "url_submit",
    "viewport_set",
    "stream_profile",
    "nav_back",
    "nav_forward",
    "reload"
  ].includes(event.type);
}

function seqKeyFor(event: BridgeEvent): string {
  return [event.sessionId, event.playerId ?? "anonymous", event.source ?? "unknown"].join(":");
}

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function enqueueMediaEvent(profileName: StreamProfileName): void {
  const profile = resolveStreamProfile(profileName);
  mediaEvents.push({
    id: ++mediaEventId,
    type: "stream_profile",
    profile: profile.name,
    width: profile.width,
    height: profile.height,
    mediaWidth: profile.mediaWidth,
    createdAt: Date.now()
  });
  if (mediaEvents.length > 100) {
    mediaEvents.splice(0, mediaEvents.length - 100);
  }
}

function mediaState(): { status: string; rtspUrl: string; streamProfile: StreamProfileName; width: number; height: number; mediaWidth: number; lastEventId: number } {
  const profile = resolveStreamProfile(streamProfile);
  return {
    status: "control-ready",
    rtspUrl: "rtsp://127.0.0.1:8554/browser",
    streamProfile: profile.name,
    width: profile.width,
    height: profile.height,
    mediaWidth: profile.mediaWidth,
    lastEventId: mediaEventId
  };
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function shutdown(): Promise<void> {
  console.log("Shutting down VRC Browser Bridge control server...");
  wss.close();
  server.close();
  await browser.stop();
  process.exit(0);
}
