# Protocol

All event payloads are JSON. Keep the protocol small and versioned.

## Log Prefix

VRChat/Udon should write one event per line:

```text
VRCBRIDGE {"v":1,"sessionId":"demo","seq":1,"type":"pointer_down","x":0.5,"y":0.5}
```

For direct local Companion mode:

```text
VRCBRIDGE_LOCAL {"v":1,"sessionId":"demo","seq":1,"type":"pointer_down","x":0.5,"y":0.5}
```

The Companion reads one complete event per line. Do not split JSON across multiple `Debug.Log` calls.

Minimum valid gateway event:

```json
{"v":1,"sessionId":"demo","seq":1,"type":"pointer_move","x":0.5,"y":0.5}
```

Recommended event with identity:

```json
{
  "v": 1,
  "sessionId": "demo",
  "seq": 42,
  "playerId": "vrchat-player-id",
  "playerName": "Display Name",
  "source": "gateway",
  "type": "pointer_down",
  "x": 0.42,
  "y": 0.63,
  "button": "left"
}
```

## Common Fields

```json
{
  "v": 1,
  "sessionId": "demo",
  "seq": 123,
  "playerId": "vrchat-player-or-local-id",
  "playerName": "optional display name",
  "source": "gateway|direct|mock",
  "ts": 1780000000000
}
```

Do not trust `playerName` for security. In Udon gateway mode, the BridgeRouter should use VRChat `NetworkCalling.CallingPlayer` where possible.

## Pointer Events

Coordinates are normalized screen coordinates:

- `x`: 0.0 left, 1.0 right
- `y`: 0.0 top, 1.0 bottom

```json
{
  "v": 1,
  "type": "pointer_move",
  "seq": 10,
  "x": 0.42,
  "y": 0.63,
  "buttons": 0
}
```

```json
{
  "v": 1,
  "type": "pointer_down",
  "seq": 11,
  "x": 0.42,
  "y": 0.63,
  "button": "left"
}
```

```json
{
  "v": 1,
  "type": "pointer_up",
  "seq": 12,
  "x": 0.42,
  "y": 0.63,
  "button": "left"
}
```

## Wheel Event

```json
{
  "v": 1,
  "type": "wheel",
  "seq": 13,
  "x": 0.42,
  "y": 0.63,
  "deltaX": 0,
  "deltaY": -480
}
```

## Text Event

Use committed text rather than individual key events for MVP.

```json
{
  "v": 1,
  "type": "text_commit",
  "seq": 14,
  "text": "hello"
}
```

## URL Event

```json
{
  "v": 1,
  "type": "url_submit",
  "seq": 15,
  "url": "https://example.com"
}
```

Server must normalize and validate URLs.

## Browser Commands

```json
{"v":1,"type":"nav_back","seq":16}
{"v":1,"type":"nav_forward","seq":17}
{"v":1,"type":"reload","seq":18}
```

## Stream Profile

`stream_profile` is the shared UI event for the VRChat world, web console, browser controller, and media pipeline.

```json
{
  "v": 1,
  "type": "stream_profile",
  "seq": 19,
  "profile": "720p"
}
```

Supported profiles:

- `360p`: browser viewport 640x360, ffmpeg output width 640.
- `720p`: browser viewport 1280x720, ffmpeg output width 1280.
- `1080p`: browser viewport 1920x1080, ffmpeg output width 1920.
- `auto`: currently resolves to 1280x720 for MVP; later it can adapt to player/client/network conditions.

## Control Lock

```json
{
  "v": 1,
  "type": "lock_request",
  "seq": 20,
  "mode": "exclusive"
}
```

```json
{
  "v": 1,
  "type": "lock_release",
  "seq": 21
}
```

## Rate Limits

Recommended defaults:

- `pointer_move`: 10-20 Hz maximum per player.
- `wheel`: coalesce every 50 ms.
- `pointer_down/up`: send immediately.
- `text_commit`: send only after text is submitted.
- `url_submit`: send only after confirmation.

## Event Deduplication

Deduplicate by:

```text
sessionId + playerId + source + seq
```

Reject old events where `seq <= lastSeq` for the same source unless replay mode is enabled.

## Current Runtime Behavior

The current Companion:

- tails a real file or the newest VRChat `output_log_*.txt`
- parses `VRCBRIDGE ` and `VRCBRIDGE_LOCAL ` lines
- validates protocol version, seq, event type, coordinates, URL/text/key shape
- forwards accepted events to the control server WebSocket
- logs server responses including applied, rejected, duplicate, and failed events

The current control server defaults to open collaboration. Any valid forwarded event can control Chromium. If the control server is started with `CONTROL_MODE=locked`, input/navigation events require a `lock_request` first.
