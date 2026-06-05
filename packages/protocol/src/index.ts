export const PROTOCOL_VERSION = 1 as const;

export const BRIDGE_LOG_PREFIX = "VRCBRIDGE ";
export const BRIDGE_LOCAL_LOG_PREFIX = "VRCBRIDGE_LOCAL ";
export {
  resolveStreamProfile,
  streamProfileNames,
  streamProfiles,
  type StreamProfile,
  type StreamProfileName
} from "./streamProfiles.js";
import { isStreamProfileName, resolveStreamProfile, type StreamProfileName } from "./streamProfiles.js";

export type EventSource = "gateway" | "direct" | "mock";
export type PointerButton = "left" | "right" | "middle";
export type BrowserEventType =
  | "pointer_move"
  | "pointer_down"
  | "pointer_up"
  | "wheel"
  | "text_commit"
  | "key_press"
  | "url_submit"
  | "viewport_set"
  | "stream_profile"
  | "nav_back"
  | "nav_forward"
  | "reload"
  | "lock_request"
  | "lock_release";

export interface BridgeEventBase {
  v: typeof PROTOCOL_VERSION;
  type: BrowserEventType;
  sessionId: string;
  seq: number;
  playerId?: string;
  playerName?: string;
  source?: EventSource;
  ts?: number;
}

export interface PointerMoveEvent extends BridgeEventBase {
  type: "pointer_move";
  x: number;
  y: number;
  buttons?: number;
}

export interface PointerButtonEvent extends BridgeEventBase {
  type: "pointer_down" | "pointer_up";
  x: number;
  y: number;
  button: PointerButton;
}

export interface WheelEvent extends BridgeEventBase {
  type: "wheel";
  x: number;
  y: number;
  deltaX?: number;
  deltaY?: number;
}

export interface TextCommitEvent extends BridgeEventBase {
  type: "text_commit";
  text: string;
}

export interface KeyPressEvent extends BridgeEventBase {
  type: "key_press";
  key: string;
}

export interface UrlSubmitEvent extends BridgeEventBase {
  type: "url_submit";
  url: string;
}

export interface ViewportSetEvent extends BridgeEventBase {
  type: "viewport_set";
  width: number;
  height: number;
}

export interface StreamProfileEvent extends BridgeEventBase {
  type: "stream_profile";
  profile: StreamProfileName;
  width?: number;
  height?: number;
}

export interface BrowserCommandEvent extends BridgeEventBase {
  type: "nav_back" | "nav_forward" | "reload" | "lock_release";
}

export interface LockRequestEvent extends BridgeEventBase {
  type: "lock_request";
  mode: "exclusive";
}

export type BridgeEvent =
  | PointerMoveEvent
  | PointerButtonEvent
  | WheelEvent
  | TextCommitEvent
  | KeyPressEvent
  | UrlSubmitEvent
  | ViewportSetEvent
  | StreamProfileEvent
  | BrowserCommandEvent
  | LockRequestEvent;

export type ValidationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };

const pointerButtons = new Set<PointerButton>(["left", "right", "middle"]);
const eventTypes = new Set<BrowserEventType>([
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
  "reload",
  "lock_request",
  "lock_release"
]);

export function parseBridgeEventJson(input: string): ValidationResult<BridgeEvent> {
  try {
    return validateBridgeEvent(JSON.parse(input));
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON"
    };
  }
}

export function parseBridgeLogLine(line: string): ValidationResult<BridgeEvent> | null {
  if (line.startsWith(BRIDGE_LOG_PREFIX)) {
    return parseBridgeEventJson(line.slice(BRIDGE_LOG_PREFIX.length));
  }

  if (line.startsWith(BRIDGE_LOCAL_LOG_PREFIX)) {
    const result = parseBridgeEventJson(line.slice(BRIDGE_LOCAL_LOG_PREFIX.length));
    if (result.ok && result.value.source === undefined) {
      result.value.source = "direct";
    }
    return result;
  }

  return null;
}

export function validateBridgeEvent(value: unknown): ValidationResult<BridgeEvent> {
  if (!isRecord(value)) {
    return fail("Event must be a JSON object");
  }

  if (value.v !== PROTOCOL_VERSION) {
    return fail("Unsupported protocol version");
  }

  if (!isNonEmptyString(value.sessionId)) {
    return fail("sessionId is required");
  }

  if (!isPositiveInteger(value.seq)) {
    return fail("seq must be a positive integer");
  }

  if (!isNonEmptyString(value.type) || !eventTypes.has(value.type as BrowserEventType)) {
    return fail("type is unsupported");
  }

  if (value.playerId !== undefined && !isNonEmptyString(value.playerId)) {
    return fail("playerId must be a non-empty string when present");
  }

  if (value.playerName !== undefined && typeof value.playerName !== "string") {
    return fail("playerName must be a string when present");
  }

  if (value.source !== undefined && !["gateway", "direct", "mock"].includes(String(value.source))) {
    return fail("source is unsupported");
  }

  if (value.ts !== undefined && !Number.isFinite(value.ts)) {
    return fail("ts must be a finite number when present");
  }

  switch (value.type) {
    case "pointer_move":
      if (!isNormalized(value.x) || !isNormalized(value.y)) {
        return fail("pointer_move requires normalized x and y");
      }
      if (value.buttons !== undefined && !Number.isInteger(value.buttons)) {
        return fail("buttons must be an integer when present");
      }
      break;

    case "pointer_down":
    case "pointer_up":
      if (!isNormalized(value.x) || !isNormalized(value.y)) {
        return fail(`${value.type} requires normalized x and y`);
      }
      if (!isNonEmptyString(value.button) || !pointerButtons.has(value.button as PointerButton)) {
        return fail(`${value.type} requires a supported button`);
      }
      break;

    case "wheel":
      if (!isNormalized(value.x) || !isNormalized(value.y)) {
        return fail("wheel requires normalized x and y");
      }
      if (value.deltaX !== undefined && !Number.isFinite(value.deltaX)) {
        return fail("deltaX must be finite when present");
      }
      if (value.deltaY !== undefined && !Number.isFinite(value.deltaY)) {
        return fail("deltaY must be finite when present");
      }
      if (value.deltaX === undefined && value.deltaY === undefined) {
        return fail("wheel requires deltaX or deltaY");
      }
      break;

    case "text_commit":
      if (typeof value.text !== "string" || value.text.length === 0 || value.text.length > 4096) {
        return fail("text_commit requires non-empty text up to 4096 characters");
      }
      break;

    case "key_press":
      if (!isAllowedKey(value.key)) {
        return fail("key_press requires a supported key");
      }
      break;

    case "url_submit":
      if (!isNonEmptyString(value.url) || value.url.length > 2048) {
        return fail("url_submit requires a URL up to 2048 characters");
      }
      break;

    case "viewport_set":
      if (!isViewportSize(value.width) || !isViewportSize(value.height)) {
        return fail("viewport_set requires width and height between 320 and 3840");
      }
      break;

    case "stream_profile": {
      if (!isStreamProfileName(value.profile)) {
        return fail("stream_profile requires profile 360p, 720p, 1080p, or auto");
      }

      const profile = resolveStreamProfile(value.profile);
      if (value.width !== undefined && value.width !== profile.width) {
        return fail(`stream_profile ${value.profile} width must be ${profile.width}`);
      }
      if (value.height !== undefined && value.height !== profile.height) {
        return fail(`stream_profile ${value.profile} height must be ${profile.height}`);
      }
      break;
    }

    case "lock_request":
      if (value.mode !== "exclusive") {
        return fail("lock_request mode must be exclusive");
      }
      break;

    case "nav_back":
    case "nav_forward":
    case "reload":
    case "lock_release":
      break;
  }

  return { ok: true, value: value as unknown as BridgeEvent };
}

export function makeDedupeKey(event: BridgeEvent): string {
  return [
    event.sessionId,
    event.playerId ?? "anonymous",
    event.source ?? "unknown",
    event.seq
  ].join(":");
}

function fail(error: string): ValidationResult<BridgeEvent> {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNormalized(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isAllowedKey(value: unknown): value is string {
  return typeof value === "string" && ["Enter", "Escape", "Tab", "Control+L"].includes(value);
}

function isViewportSize(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 320 && value <= 3840;
}
