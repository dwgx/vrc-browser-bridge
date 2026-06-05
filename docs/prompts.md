# Prompts for New AI Sessions

Use these prompts when starting a fresh session.

## General Continuation Prompt

```text
We are working on D:\Project\vrc-browser-bridge.

First read AGENTS.md, README.md, and docs/*.md. Continue from those project decisions.

Important: do not propose embedding WebView/CEF/Chromium into VRChat. That path is rejected. The correct architecture is external Chromium + Playwright/CDP + Companion log bridge + MediaMTX RTSP + VRChat AVPro.

Current desired next step: build the smallest TypeScript prototype:
- protocol event types
- WebSocket control server
- Playwright-controlled Chromium
- mock input page that sends pointer/wheel/text/url events

Keep Unity world work for later.
```

## Companion Implementation Prompt

```text
Implement the first Companion prototype for this project.

Read AGENTS.md and docs/04-companion.md first.

Build a CLI that can:
- tail a fake log file or latest VRChat output_log_*.txt
- parse lines starting with VRCBRIDGE or VRCBRIDGE_LOCAL
- validate JSON event schema
- forward events to a WebSocket endpoint
- handle reconnects and log rotation

Do not use VRChat APIs or credentials. Do not inject into VRChat.
```

## Browser Controller Prompt

```text
Implement the browser controller MVP.

Read docs/03-protocol.md and docs/06-browser-controller.md first.

Use Playwright to launch Chromium with a fixed viewport.
Create a WebSocket server that accepts VRC Browser Bridge events:
- url_submit
- pointer_move
- pointer_down
- pointer_up
- wheel
- text_commit
- nav_back
- nav_forward
- reload

Map normalized x/y coordinates to browser viewport pixels.
```

## Media Pipeline Prompt

```text
Set up the first media pipeline.

Read docs/05-media-pipeline.md first.

Goal:
Chromium window or test pattern -> ffmpeg/OBS/GStreamer -> MediaMTX -> RTSP -> VLC.

Prefer MediaMTX as the first RTSP media router.
Use low-latency H.264/AAC settings.
Do not start with HLS except as later fallback.
```

## Unity World Prompt

```text
Design the Unity/Udon integration for VRC Browser Bridge.

Read docs/07-vrchat-world-integration.md first.

Build a world prefab plan:
- AVPro screen
- collider/UIShape input surface
- UV coordinate conversion
- BridgeRouter owned by host/gateway
- Udon NetworkEvents for pointer/wheel/text/url/lock
- Debug.Log lines prefixed with VRCBRIDGE
- synced variables for lock state, session code, stream URL, cursor state

Do not implement browser rendering in Unity.
```

## Research Prompt

```text
Research one narrow technical risk for VRC Browser Bridge.

Use official docs first.
Known architecture:
external Chromium + Playwright/CDP, MediaMTX RTSP, VRChat AVPro, Udon input, Companion output_log tail.

Do not re-open rejected routes:
- WebView in VRChat world
- client injection
- image refresh browser
- StringDownloader realtime control
```
