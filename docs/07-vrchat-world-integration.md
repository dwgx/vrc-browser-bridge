# VRChat World Integration

Unity world work is a separate phase. This document defines what the world needs to produce.

## World Responsibilities

- Show the browser stream on a screen.
- Capture screen pointer coordinates.
- Capture click, scroll, URL, and text input.
- Maintain control lock UI.
- Show player cursors.
- Emit compact `VRCBRIDGE` events.

## Screen Input

Use a screen collider or world-space UI surface.

On pointer hit:

1. Get hit UV or local hit coordinate.
2. Convert to normalized browser coordinates.
3. Emit event.

Coordinate convention:

```text
x = 0 left, 1 right
y = 0 top, 1 bottom
```

## Gateway Object

Create a `BridgeRouter` Udon behavior.

Recommended behavior:

- Host presses `Take Bridge`.
- Host becomes owner of `BridgeRouter`.
- Other players send NetworkEvents to owner.
- Owner validates calling player.
- Owner writes one `Debug.Log` line per accepted event.

Example:

```text
VRCBRIDGE {"v":1,"sessionId":"demo","seq":1,"type":"pointer_down","x":0.5,"y":0.5}
```

## Synced Variables

Use synced variables for:

- current controller
- lock state
- session code
- stream URL
- cursor snapshots

Do not use synced variables for high-frequency input streams.

## Network Events

Use network events for:

- click
- pointer move, throttled
- wheel, coalesced
- text commit
- URL submit
- lock request/release

Pointer move should be throttled to 10-20 Hz.

## Video Player

Use AVPro for live streams.

PCVR target:

```text
rtsp://...
```

Quest fallback later:

```text
https://.../index.m3u8
```

## Out of Scope for World

The world must not:

- render web pages
- execute JavaScript
- connect to WebSocket
- perform realtime HTTP POST
- contain private browser credentials
