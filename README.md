# VRC Browser Bridge

Shared interactive browser bridge for VRChat worlds.

This project creates a VRChat-compatible browser terminal without embedding a browser into VRChat. A real Chromium session runs outside VRChat, is streamed into the world as low-latency video, and is controlled by VRChat input events forwarded through a Companion app.

## Current Goal

Build the smallest local prototype:

```text
mock input -> WebSocket -> Playwright/CDP -> Chromium
```

Then add:

```text
Chromium -> ffmpeg/GStreamer/OBS -> MediaMTX -> RTSP -> VRChat AVPro
```

Then add:

```text
VRChat Udon Debug.Log -> output_log tail -> Companion -> WebSocket
```

## Read First

- [AGENTS.md](AGENTS.md)
- [docs/00-project-brief.md](docs/00-project-brief.md)
- [docs/01-architecture.md](docs/01-architecture.md)
- [docs/02-mvp-roadmap.md](docs/02-mvp-roadmap.md)
- [docs/prompts.md](docs/prompts.md)

## Important Constraints

VRChat worlds do not support real WebView/CEF/Chromium. Udon cannot open arbitrary sockets or send realtime HTTP/WebSocket events. Image/string downloaders are rate-limited and unsuitable for realtime browser interaction.

The correct approach is external rendering plus VRChat-compatible video and input bridging.

## High-Level Components

- VRChat World: screen, pointer surface, input UI, lock UI.
- Companion: local bridge that reads VRChat logs and talks to the control server.
- Browser Controller: Chromium + Playwright/CDP.
- Media Pipeline: browser capture + low-latency H.264/AAC encoding.
- MediaMTX: RTSP output to VRChat AVPro.
- Control Server: optional session, lock, deduplication, and event routing.

## MVP First

Do not start by building the Unity world. First prove:

- Browser can be controlled externally.
- Events can be serialized and replayed.
- Video can be streamed to an RTSP player.
- A log-tail bridge can parse `VRCBRIDGE` events.

## Local Prototype

Install dependencies:

```powershell
npm.cmd install
npx.cmd playwright install chromium
```

Start the Phase 0 loop:

```powershell
npm.cmd run dev
```

Then open:

```text
http://127.0.0.1:8787
```

The mock page sends normalized pointer, wheel, text, URL, back, forward, and reload events over WebSocket to the control server. The server validates and deduplicates those events, then applies them to one Playwright-controlled Chromium session.

PowerShell may block `npm` through `npm.ps1` on machines with restricted script execution. Use `npm.cmd` and `npx.cmd` as shown above.

The default control mode is open collaboration: any valid client event can control Chromium. For later moderated tests, start with `CONTROL_MODE=locked` to require the optional control marker before input is accepted.

Run the Companion log bridge:

```powershell
npm.cmd run companion -- --tail-vrchat
```

Fake log test:

```powershell
New-Item -ItemType File -Force -Path .\fake-output.log
npm.cmd run companion -- --tail-file .\fake-output.log
Add-Content -LiteralPath .\fake-output.log -Value 'VRCBRIDGE {"v":1,"sessionId":"demo","seq":1,"playerId":"fake","source":"gateway","type":"pointer_move","x":0.5,"y":0.5}'
```

Run the RTSP media pipeline:

```powershell
npm.cmd run media -- --dry-run
npm.cmd run media -- --mediamtx-bin .\tools\mediamtx\mediamtx.exe --ffmpeg-bin .\tools\ffmpeg\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe
```

The default RTSP URL is:

```text
rtsp://127.0.0.1:8554/browser
```
