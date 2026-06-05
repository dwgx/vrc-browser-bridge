# Media Pipeline

## Goal

Stream the real browser into VRChat with the lowest practical latency.

Recommended PCVR path:

```text
Chromium
  -> capture
  -> H.264/AAC low-latency encode
  -> MediaMTX
  -> RTSP
  -> VRChat AVPro
```

## Why MediaMTX

MediaMTX is the best first media router because it can ingest and output multiple protocols, including RTSP. It is simpler for this project than SRS when VRChat RTSP output is the primary target.

SRS is still interesting later for WebRTC/HLS ecosystems, but not the first RTSP outlet.

## Encoding Guidance

Use:

- H.264 video
- AAC audio
- yuv420p
- constant bitrate or constrained bitrate
- no B frames
- short GOP, around 0.5-1 second
- small buffer

Avoid:

- high-latency HLS as the primary PCVR path
- image refresh
- WebRTC as the final VRChat path

## Local Test Path

First test outside VRChat:

```text
Chromium -> ffmpeg/OBS -> MediaMTX -> VLC
```

Then test inside VRChat:

```text
rtsp://host:8554/browser
```

## Current CLI

Dry run:

```powershell
npm.cmd run media -- --dry-run
```

Start MediaMTX and FFmpeg:

```powershell
npm.cmd run media -- --mediamtx-bin .\tools\mediamtx\mediamtx.exe --ffmpeg-bin .\tools\ffmpeg\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe
```

If binaries are not on `PATH`, pass explicit paths:

```powershell
npm.cmd run media -- --mediamtx-bin C:\tools\mediamtx.exe --ffmpeg-bin C:\tools\ffmpeg.exe
```

The current default publishes:

```text
rtsp://127.0.0.1:8554/browser
```

Use that URL in VLC first. After VLC works, use the host machine IP for VRChat AVPro:

```text
rtsp://192.168.1.50:8554/browser
```

## Current FFmpeg Strategy

The first Windows path uses `gdigrab`:

```powershell
ffmpeg -f gdigrab -framerate 30 -i desktop `
  -vf scale=1280:-2 `
  -pix_fmt yuv420p `
  -c:v libx264 -preset ultrafast -tune zerolatency -bf 0 -g 30 `
  -an `
  -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/browser
```

This captures the desktop, so keep Chromium visible. Later versions should capture a fixed browser window or DXGI Desktop Duplication.

Hard requirements:

- MediaMTX must be installed or passed with `--mediamtx-bin`.
- FFmpeg must be installed or passed with `--ffmpeg-bin`.
- VRChat PC users need AVPro-compatible RTSP playback.
- Localhost only works on the same machine. VRChat clients need the host LAN IP or a reachable server address.

## OBS vs ffmpeg vs GStreamer

OBS:

- easiest for manual local MVP
- good window capture and browser source
- convenient audio mixing

ffmpeg:

- best for automation
- good for CLI MVP and service mode

GStreamer:

- strongest for Linux/GPU/low-copy final systems
- more complex

## Quest/Android

PCVR RTSP is the main target.

Quest/Android should later receive HTTPS HLS fallback, accepting higher latency. Do not let Quest constraints weaken the first PCVR prototype.
