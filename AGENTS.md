# VRC Browser Bridge - Project Memory

This file is the first thing a new AI session should read.

## Mission

Build a VRChat-compatible shared browser bridge.

The goal is not to embed a real browser inside VRChat. VRChat does not support WebView/CEF/Chromium in worlds. The correct product is a VRChat world that acts as a shared browser terminal:

- VRChat displays a low-latency video stream of one real browser session.
- VRChat captures pointer, wheel, text, URL, and control-lock events.
- A local Companion app bridges VRChat events to an external browser controller.
- Chromium is the single authority for page state.
- MediaMTX provides RTSP output for VRChat PC players.

## Core Decision

Never try to put a real browser into VRChat. Use external browser rendering + video streaming + input bridge.

```text
VRChat World
  -> captures input and shows video

Companion
  -> tails VRChat output_log
  -> parses VRCBRIDGE events
  -> sends events over WebSocket

Browser Controller
  -> controls Chromium via Playwright/CDP
  -> executes click/wheel/type/navigation

Media Pipeline
  -> captures Chromium video/audio
  -> encodes H.264/AAC low latency
  -> publishes to MediaMTX
  -> VRChat AVPro plays RTSP
```

## Non-Negotiable Constraints

- No VRChat client injection.
- No EAC bypass.
- No modded client requirement.
- No WebView/CEF in world.
- No image-refresh browser; VRCImageDownloader is too slow.
- No VRCStringDownloader as a realtime input channel.
- No Udon as a general TCP/WebSocket/HTTP client.

## Best Architecture

Use a hybrid input path:

1. Gateway path, compatible with everyone:
   - Player interacts with world.
   - Udon sends NetworkEvent to the BridgeRouter owner.
   - Owner logs `VRCBRIDGE {...}` via `Debug.Log`.
   - Host Companion tails output log and forwards to server.

2. Direct path, optional low-latency path:
   - Each PC player may run Companion.
   - Their local Companion tails their own output log.
   - It sends events directly to the control server.
   - Server deduplicates by `sessionId + playerId + seq`.

## Initial MVP

Do not start with Unity.

Start with this local loop:

```text
mock input page
  -> WebSocket event
  -> Companion / control server
  -> Playwright controls Chromium
  -> later: Chromium video goes to MediaMTX RTSP
```

After the local loop works, replace the mock input source with VRChat output-log events.

## Suggested Repository Layout

```text
vrc-browser-bridge/
  AGENTS.md
  README.md
  docs/
    00-project-brief.md
    01-architecture.md
    02-mvp-roadmap.md
    03-protocol.md
    04-companion.md
    05-media-pipeline.md
    06-browser-controller.md
    07-vrchat-world-integration.md
    08-ai-ocr-future.md
    09-security.md
    10-research-sources.md
    prompts.md
  apps/
    companion/
    control-server/
    mock-input/
  packages/
    protocol/
  infra/
    mediamtx/
```

## First Engineering Target

Build a Node/TypeScript prototype:

- `packages/protocol`: shared event types.
- `apps/control-server`: WebSocket server.
- `apps/browser-controller` or inside Companion: Playwright launches Chromium.
- `apps/mock-input`: webpage that sends click/wheel/text/url events.

First success condition:

- Chromium opens.
- Mock page sends pointer event.
- Playwright clicks the matching browser coordinate.
- URL submit navigates Chromium.
- Wheel scrolls Chromium.
- Text commit types into focused field.

Second success condition:

- ffmpeg/MediaMTX publishes browser video as RTSP.
- VLC or VRChat can view it.

Third success condition:

- Companion tails a fake log file containing `VRCBRIDGE {...}` lines.
- The same events control Chromium.

## Development Style

- Prefer narrow working prototypes over large platform code.
- Keep protocols explicit and versioned.
- Separate browser control, media output, and VRChat input bridge.
- Treat VRChat as an untrusted input source.
- Do not store VRChat credentials.
- Do not store browser cookies by default.

## Terms

- Companion: local desktop bridge app, not a mod.
- BridgeRouter: Udon object owned by host/gateway player.
- Control Server: WebSocket/session/lock/event arbitration service.
- Browser Runtime: Chromium controlled by Playwright/CDP.
- MediaMTX: media router used to output RTSP to VRChat.
