# Architecture

## Final Shape

```text
                 +-----------------------------+
                 |         VRChat World        |
                 | screen + input + lock state |
                 +--------------+--------------+
                                |
                         Udon Debug.Log
                                |
                                v
                 +-----------------------------+
                 |          Companion          |
                 | output_log tail + WebSocket |
                 +--------------+--------------+
                                |
                                v
                 +-----------------------------+
                 |       Control Server        |
                 | auth + lock + dedupe + ACL  |
                 +--------------+--------------+
                                |
                                v
                 +-----------------------------+
                 |      Browser Runtime        |
                 | Chromium + Playwright/CDP   |
                 +--------------+--------------+
                                |
                         video/audio capture
                                |
                                v
                 +-----------------------------+
                 |       Media Pipeline        |
                 | ffmpeg/GStreamer/OBS        |
                 +--------------+--------------+
                                |
                                v
                 +-----------------------------+
                 |          MediaMTX           |
                 | RTSP for PCVR, HLS fallback |
                 +--------------+--------------+
                                |
                                v
                         VRChat AVPro
```

## Runtime Modes

### Local Host Mode

The host's PC runs:

- Companion
- Chromium
- Playwright/CDP control
- ffmpeg/OBS capture

The server only provides MediaMTX or nothing in the earliest local test.

This mode is best for MVP and private rooms.

### Cloud Browser Mode

The server runs:

- isolated Chromium per room
- browser controller
- media capture/encoding
- MediaMTX output

The host runs only Companion for VRChat log bridge, or no Companion if control is through external web UI.

This mode is best for public service.

## Input Paths

### Gateway Path

Compatible with all VRChat users.

```text
player input
  -> Udon NetworkEvent to BridgeRouter owner
  -> owner Debug.Log VRCBRIDGE event
  -> host Companion
  -> Control Server
```

### Direct Companion Path

Lower latency for PC users who install Companion.

```text
local player input
  -> local Debug.Log VRCBRIDGE_LOCAL event
  -> local Companion
  -> Control Server
```

The server deduplicates events using:

```text
sessionId + playerId + source + seq
```

## Media Path

Recommended for PCVR:

```text
Chromium
  -> H.264/AAC low-latency encode
  -> MediaMTX
  -> rtsp://host:8554/session
  -> VRChat AVPro
```

Quest/Android should receive HTTPS HLS fallback later. PCVR RTSP is the primary target.

## Why Not WebRTC Directly?

WebRTC is excellent for browsers, but VRChat AVPro does not directly play WebRTC streams. WebRTC can be used for a web control dashboard, but VRChat needs RTSP/HLS/allowlisted video URLs.
