# Research Notes

## 2026-06-05 Remote Browser and UI References

Useful projects and docs reviewed:

- BrowserPane: shared remote browser architecture with session state, owner/viewer split, input channels, and inspection surfaces.
- Neko: collaborative browser/desktop model with shared control and viewer roles.
- Browserless: browser-as-a-service session lifecycle, live debugger, token/error model, and reconnect semantics.
- noVNC: remote display UI patterns, view-only mode, clipboard, scaling, status affordances, and compact controls.
- Apache Guacamole: clean separation between web UI, protocol gateway, and remote display/control backend.
- KasmVNC: shared/read-only modes, IME/clipboard handling, cursor lock, and performance statistics.
- Selenium Grid and docker-selenium: future multi-session lifecycle ideas such as session map, node state, queueing, and video sidecars.
- MediaMTX + FFmpeg docs: RTSP publish path, TCP transport, low-latency H.264 settings, and WebRTC/HLS as diagnostics/fallbacks.
- VRChat video player and AVPro docs: PC VRChat should use AVPro-compatible streams; RTSP is the current primary target for low-latency PC playback.
- OWASP SSRF prevention: URL submit must be validated server-side, including private IP and non-http scheme blocking.

## Product Direction

The mock input page should act like a Chinese shared browser control console, not a temporary test pad.

MVP console structure:

- Top bar: project name, address bar, back/forward/reload, server/browser/media status.
- Main viewer: large 16:9 browser preview/control surface with normalized coordinates.
- Control lock: prominent state such as `无人控制`, `我正在控制`, or `由某玩家控制中`.
- Right panel: tabs for control, clipboard, performance, and event logs.
- Bottom status: sessionId, playerId, seq, WebSocket latency, last event.

## Logic Direction

Immediate protocol/server improvements:

- `lock_request` and `lock_release` are first-class events.
- Input/navigation events require the active control lock.
- Server broadcasts `server_state` with browser state, lock state, and media placeholder state.
- Event responses include applied/rejected/duplicate/failed outcomes and RTT where possible.
- Control lock TTL starts at 30 seconds and is extended by valid input.

Media pipeline should remain separate from the control server:

```text
apps/media-pipeline
  -> MediaMTX lifecycle
  -> ffmpeg lifecycle
  -> capture target
  -> rtsp://127.0.0.1:8554/browser
```

Initial Windows ffmpeg path:

```powershell
ffmpeg -f gdigrab -framerate 30 -i desktop `
  -vf scale=1280:-2 `
  -pix_fmt yuv420p `
  -c:v libx264 -preset ultrafast -tune zerolatency -bf 0 -g 30 `
  -an `
  -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/browser
```
