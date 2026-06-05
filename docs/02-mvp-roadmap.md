# MVP Roadmap

## Phase 0 - Protocol and Mock Control

Goal:

```text
mock input -> WebSocket -> Playwright -> Chromium
```

Tasks:

1. Create shared event schema.
2. Launch Chromium with Playwright.
3. Build WebSocket receiver.
4. Build mock input page.
5. Implement pointer click, wheel, text, URL navigation.

Success:

- A click event at normalized coordinates clicks inside Chromium.
- A wheel event scrolls.
- A text event types into focused input.
- A URL event navigates.

## Phase 1 - Log Tail Companion

Goal:

```text
VRCBRIDGE log lines -> Companion -> same browser control path
```

Tasks:

1. Implement tailer for VRChat output logs.
2. Support a fake log file for testing.
3. Parse lines prefixed with `VRCBRIDGE `.
4. Validate JSON and sequence numbers.
5. Forward valid events to WebSocket/control server.

Success:

- Writing a fake `VRCBRIDGE {"type":"pointer_down",...}` line controls Chromium.

## Phase 2 - Media Pipeline

Goal:

```text
Chromium -> MediaMTX -> RTSP viewer
```

Tasks:

1. Run MediaMTX locally.
2. Capture browser window or virtual display.
3. Encode H.264/AAC with low-latency settings.
4. Publish to MediaMTX.
5. View stream in VLC.
6. Later test in VRChat AVPro.

Success:

- VLC can open `rtsp://localhost:8554/browser`.
- Latency is usable for click feedback.

## Phase 3 - VRChat World Integration

Goal:

```text
VRChat input -> Debug.Log -> Companion -> Chromium
```

Tasks:

1. Make a Unity/Udon prefab with a screen collider.
2. Calculate normalized UV coordinates from ray hit.
3. Emit pointer, wheel, text, and URL events.
4. Add BridgeRouter owner/gateway logic.
5. Add control lock UI.
6. Add colored cursors.

Success:

- A VRChat player clicks the screen and controls Chromium.

## Phase 4 - Cloud Browser

Goal:

```text
session code -> server creates isolated browser -> world connects to stream
```

Tasks:

1. Session orchestrator.
2. Isolated browser runtime.
3. Auth tokens.
4. Media pipeline per session.
5. Lock and moderation tools.

This is not needed for the first local prototype.
