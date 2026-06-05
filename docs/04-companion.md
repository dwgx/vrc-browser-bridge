# Companion

## Definition

Companion is a local desktop bridge app.

It is not:

- a VRChat mod
- a client injection
- an EAC bypass
- a Unity component

It is just a normal external program that reads VRChat log files and talks to the bridge backend.

## Responsibilities

MVP responsibilities:

- Locate latest VRChat `output_log_*.txt`.
- Tail new lines.
- Parse lines beginning with `VRCBRIDGE ` or `VRCBRIDGE_LOCAL `.
- Validate JSON.
- Forward events to local/browser control WebSocket.
- Show current status in console or simple UI.

Later responsibilities:

- Start/stop local Chromium.
- Start/stop ffmpeg or OBS.
- Start/stop local MediaMTX.
- Show stream URL and session code.
- Provide host controls: lock, reset, close browser.

## Log Tail Strategy

VRChat logs are located under:

```text
%USERPROFILE%\AppData\LocalLow\VRChat\VRChat
```

Typical files:

```text
output_log_*.txt
```

The tailer should:

- choose newest matching file
- follow file growth
- handle log rotation
- ignore old historical lines unless replay mode is enabled
- parse only prefixed lines

## Example Lines

```text
VRCBRIDGE {"v":1,"sessionId":"demo","seq":1,"type":"pointer_down","x":0.5,"y":0.5}
VRCBRIDGE {"v":1,"sessionId":"demo","seq":2,"type":"pointer_up","x":0.5,"y":0.5}
VRCBRIDGE {"v":1,"sessionId":"demo","seq":3,"type":"wheel","x":0.5,"y":0.5,"deltaY":-480}
```

## Security Notes

- Do not ask for VRChat credentials.
- Do not call private VRChat APIs for core functionality.
- Do not trust display names as identity.
- Do not execute arbitrary commands from log lines.
- Do not allow arbitrary local file access through browser commands.

## CLI MVP

Suggested command:

```text
npm.cmd run companion -- --session demo --control ws://127.0.0.1:8787 --tail-vrchat
```

Fake log test:

```text
npm.cmd run companion -- --session demo --control ws://127.0.0.1:8787 --tail-file ./fake-output.log
```

Replay existing fake log content:

```text
npm.cmd run companion -- --session demo --control ws://127.0.0.1:8787 --tail-file ./fake-output.log --from-start
```

Append a test event in PowerShell:

```powershell
Add-Content -LiteralPath .\fake-output.log -Value 'VRCBRIDGE {"v":1,"sessionId":"demo","seq":1,"playerId":"fake","source":"gateway","type":"pointer_move","x":0.5,"y":0.5}'
```
