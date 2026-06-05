# Unity World Build Plan

## Target

Build a VRChat world prefab that behaves like a shared browser terminal:

```text
Screen collider + Udon input
  -> VRCBRIDGE JSON Debug.Log
  -> Companion tails output_log
  -> control server WebSocket
  -> Playwright Chromium
  -> MediaMTX RTSP shown on AVPro video screen
```

Do not embed a browser in Unity. Unity only renders the video stream and emits input events.

## Scene Objects

Minimum prefab:

- `VRCBrowserBridgeRoot`
- `BrowserScreen`
  - Quad or plane with 16:9 mesh
  - Collider for ray hit
  - AVPro video player target material
- `BridgeInputSurface`
  - UdonBehaviour for pointer hit mapping
  - Reads hit UV or local point
  - Emits normalized `x` and `y`
- `BridgeRouter`
  - UdonBehaviour owned by host/gateway player
  - Receives networked input events
  - Writes one `VRCBRIDGE {...}` log line per event
- `BridgeControlPanel`
  - URL input
  - Text input
  - Back/forward/reload buttons
  - Stream URL display
- Optional:
  - cursor markers per player
  - status labels
  - host moderation controls

## Log Protocol

Every log line must be a single complete event:

```text
VRCBRIDGE {"v":1,"sessionId":"demo","seq":1,"playerId":"usr_x","playerName":"Alice","source":"gateway","type":"pointer_down","x":0.5,"y":0.5,"button":"left"}
```

Required fields:

- `v`: always `1`
- `sessionId`: world/session code, default `demo` during MVP
- `seq`: monotonically increasing integer per sender/source
- `type`: event type

Recommended fields:

- `playerId`: stable player identifier where available
- `playerName`: display name only, never trusted for auth
- `source`: `gateway` for BridgeRouter logs, `direct` for local Companion logs
- `ts`: local timestamp if easy

## Event Types To Emit

Pointer:

```json
{"v":1,"sessionId":"demo","seq":1,"type":"pointer_move","x":0.1,"y":0.2,"buttons":0}
{"v":1,"sessionId":"demo","seq":2,"type":"pointer_down","x":0.1,"y":0.2,"button":"left"}
{"v":1,"sessionId":"demo","seq":3,"type":"pointer_up","x":0.1,"y":0.2,"button":"left"}
```

Wheel:

```json
{"v":1,"sessionId":"demo","seq":4,"type":"wheel","x":0.1,"y":0.2,"deltaY":-480}
```

Text and URL:

```json
{"v":1,"sessionId":"demo","seq":5,"type":"text_commit","text":"hello"}
{"v":1,"sessionId":"demo","seq":6,"type":"url_submit","url":"https://example.com"}
```

Commands:

```json
{"v":1,"sessionId":"demo","seq":7,"type":"nav_back"}
{"v":1,"sessionId":"demo","seq":8,"type":"nav_forward"}
{"v":1,"sessionId":"demo","seq":9,"type":"reload"}
```

## Coordinate Mapping

Browser coordinates are normalized:

- `x = 0.0` left, `x = 1.0` right
- `y = 0.0` top, `y = 1.0` bottom

For a Unity screen mesh:

```text
x = hitUv.x
y = 1.0 - hitUv.y
```

If using local plane coordinates:

```text
x = inverseLerp(left, right, localX)
y = inverseLerp(top, bottom, localY)
```

Clamp both values to `[0, 1]`.

## Rate Limits

Udon should not spam logs:

- `pointer_move`: max 10-20 Hz per active player
- `wheel`: coalesce within 50 ms
- `pointer_down/up`: immediate
- `text_commit`: only on submit
- `url_submit`: only on confirm

The current control server deduplicates by:

```text
sessionId + playerId + source + seq
```

## Unity Work Order

1. Confirm MCP can read scene hierarchy and console.
2. Create a simple 16:9 screen plane and collider.
3. Add AVPro/USharpVideo-compatible video display path.
4. Add `BridgeRouter` UdonSharp script.
5. Add pointer hit mapping script.
6. Add URL/text control panel.
7. Emit fake static events first and verify Companion receives them.
8. Emit real pointer events and verify Chromium moves/clicks.
9. Load RTSP URL in the world video player.
10. Add polish: visible cursor, status text, host reset button.

## Current Local Runtime

Control server:

```powershell
npm.cmd run dev
```

Companion:

```powershell
npm.cmd run companion -- --tail-vrchat
```

Media pipeline:

```powershell
npm.cmd run media -- --mediamtx-bin .\tools\mediamtx\mediamtx.exe --ffmpeg-bin .\tools\ffmpeg\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe
```

RTSP URL:

```text
rtsp://HOST_LAN_IP:8554/browser
```
