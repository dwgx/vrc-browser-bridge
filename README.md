# VRC Browser Bridge

**在 VRChat 世界中使用真实浏览器 — A real browser inside VRChat worlds**

## Overview / 概述

VRChat worlds cannot embed a real browser (no WebView, no CEF, no Chromium, Udon can't open realtime sockets). This project takes the only workable path: a real Chromium session runs outside VRChat, gets streamed into the world as low-latency RTSP video, and is driven by input events forwarded from VRChat through a local Companion app. Chromium stays the single authority for page state.

VRChat 世界里没法嵌入真正的浏览器（没有 WebView/CEF/Chromium，Udon 也不能开实时 socket）。这个项目走唯一能走的路：本地跑一个真实的 Chromium 会话，通过 RTSP 流推到世界里当视频，再通过本地 Companion 应用把 VRChat 里的输入事件转发回来控制浏览器。Chromium 始终是页面状态的唯一权威。

Architecture / 架构:

```text
mock input / VRChat Udon -> WebSocket -> Playwright/CDP -> Chromium
Chromium -> FFmpeg -> MediaMTX -> RTSP -> VRChat AVPro
VRChat output_log -> Companion -> WebSocket -> Control Server
```

## Features / 功能

- Normalized browser-control protocol (`@vrcbb/protocol`) with versioned, validated event schema
- Control server drives one Chromium session via Playwright/CDP:
  - pointer move / down / up, wheel, text commit, key press (`Enter`, `Escape`, `Tab`, `Control+L`)
  - URL submit, back / forward / reload, viewport set, stream profile switch
- Event validation, per-source sequence ordering, deduplication (`sessionId + playerId + source + seq`)
- Exclusive control lock (`lock_request` / `lock_release`) with 30s TTL, plus `open` vs `locked` control modes
- Mock input web page for driving Chromium without VRChat
- Companion app tails VRChat `output_log_*.txt` and forwards `VRCBRIDGE` / `VRCBRIDGE_LOCAL` log lines over WebSocket
- Media pipeline: MediaMTX + FFmpeg, publishes browser capture as RTSP, supports `--dry-run` and live stream-profile switching
- HTTP endpoints: `/health`, `/media-state`, `/media-control/events`, `/snapshot` (JPEG screenshot)
- Stream profiles: `360p`, `720p`, `1080p`, `auto`

---

- 标准化浏览器控制协议 (`@vrcbb/protocol`)，事件 schema 版本化 + 运行时校验
- Control Server 通过 Playwright/CDP 驱动一个 Chromium 会话：
  - 鼠标移动/按下/抬起、滚轮、文字提交、按键（Enter、Escape、Tab、Ctrl+L）
  - URL 提交、前进/后退/刷新、视口设置、流 profile 切换
- 事件校验、按来源序列排序、去重（`sessionId + playerId + source + seq`）
- 独占控制锁（`lock_request` / `lock_release`），30s TTL，支持 `open` / `locked` 两种控制模式
- Mock 输入页面，不用 VRChat 就能调试浏览器控制
- Companion 应用监听 VRChat `output_log_*.txt`，转发 `VRCBRIDGE` / `VRCBRIDGE_LOCAL` 日志行到 Control Server
- 媒体管线：MediaMTX + FFmpeg，把浏览器画面发布为 RTSP 流，支持 `--dry-run` 和运行时 profile 切换
- HTTP 接口：`/health`、`/media-state`、`/media-control/events`、`/snapshot`（JPEG 截图）
- 流 profile：`360p`、`720p`、`1080p`、`auto`

## Tech Stack / 技术栈

| Layer | Choice |
| --- | --- |
| Language | TypeScript (ES2022, NodeNext, strict) |
| Runtime | Node.js (v24 types), `tsx` for dev, `tsc -b` for build |
| Monorepo | npm workspaces (`apps/*`, `packages/*`) |
| Browser | Playwright (Chromium) |
| Transport | `ws` WebSocket, Node `http` |
| Media | MediaMTX + FFmpeg (external binaries, not bundled) |

## Project Structure / 项目结构

```text
vrc-browser-bridge/
  apps/
    control-server/     WebSocket + HTTP server; Playwright 驱动 Chromium, 提供 mock input
    companion/          监听 VRChat/output 日志, 转发 VRCBRIDGE 事件
    media-pipeline/     构建并运行 MediaMTX + FFmpeg, 发布 RTSP 流
    mock-input/         静态网页 (public/), 通过 WebSocket 发送控制事件
  packages/
    protocol/           共享事件类型 + 校验 (@vrcbb/protocol)
  infra/
    mediamtx/           MediaMTX 配置 (RTSP/HLS/WebRTC, path "browser")
  docs/                 架构文档、协议规范、路线图、研究笔记
```

## Getting Started / 快速开始

### Prerequisites / 前置要求

- Node.js (recent LTS; repo targets `@types/node` v24)
- npm (workspaces)
- Media pipeline only: FFmpeg and MediaMTX on `PATH` or passed explicitly

### Install / 安装

```powershell
npm.cmd install
npx.cmd playwright install chromium
```

> Windows 下 PowerShell 可能会因脚本执行策略拦截 `.ps1` shim，直接用 `npm.cmd` / `npx.cmd` 就行。

### Run / 运行

Start the control server (launches Chromium + mock input page):

启动 control server（自动拉起 Chromium 和 mock 输入页）：

```powershell
npm.cmd run dev
```

Open the mock input page at `http://127.0.0.1:8787`, use it to send pointer/wheel/text/URL/navigation events. The server validates, deduplicates, and applies them to the Chromium session.

打开 `http://127.0.0.1:8787` 的 mock 输入页，可以发送各种控制事件，server 会校验去重后应用到 Chromium 会话。

### Companion (log bridge)

Tail the newest VRChat log:

```powershell
npm.cmd run companion -- --tail-vrchat
```

Or test against a fake log:

```powershell
New-Item -ItemType File -Force -Path .\fake-output.log
npm.cmd run companion -- --tail-file .\fake-output.log
Add-Content -LiteralPath .\fake-output.log -Value 'VRCBRIDGE {"v":1,"sessionId":"demo","seq":1,"playerId":"fake","source":"gateway","type":"pointer_move","x":0.5,"y":0.5}'
```

Options: `--control <ws-url>` (default `ws://127.0.0.1:8787`), `--session <id>`, `--tail-file <path>`, `--tail-vrchat`, `--from-start`, `--player-id <id>`, `--source <gateway|direct>`. On Windows it looks for `output_log_*.txt` under `%LOCALAPPDATA%Low\VRChat\VRChat`.

### Media Pipeline (RTSP)

Dry run (print commands without executing):

```powershell
npm.cmd run media -- --dry-run
```

Run with explicit binaries:

```powershell
npm.cmd run media -- --mediamtx-bin <path> --ffmpeg-bin <path>
```

Default RTSP URL (publish/playback in VLC or VRChat AVPro):

```
rtsp://127.0.0.1:8554/browser
```

Options: `--rtsp-url`, `--capture <desktop|title=...>`, `--framerate`, `--width`, `--encoder <libx264|h264_nvenc>`, `--preset`, `--control-url <http://...>`, `--profile-poll-ms`, `--skip-mediamtx`. Run `npm.cmd run media -- --help` for full list.

## Configuration / 配置

Control server environment variables (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP + WebSocket listen port (bound to `127.0.0.1`) |
| `CONTROL_MODE` | `open` | `open` = accept any valid event; `locked` = require held control lock |
| `BROWSER_WIDTH` | `1280` | Initial Chromium viewport width |
| `BROWSER_HEIGHT` | `720` | Initial Chromium viewport height |
| `START_URL` | `https://example.com` | Page Chromium opens on start |
| `HEADLESS` | (unset) | Set `1` to run Chromium headless |

## Protocol / 协议

Events are JSON: fixed protocol version (`v: 1`), `sessionId`, monotonically increasing `seq`, and `type`. Coordinates normalized to `0..1`. Log-forwarded events use `VRCBRIDGE ` prefix (gateway path) or `VRCBRIDGE_LOCAL ` (direct path). Authoritative definitions: `packages/protocol/src/index.ts` and `docs/03-protocol.md`.

事件格式为 JSON：固定协议版本 (`v: 1`)，包含 `sessionId`、单调递增 `seq` 和 `type`。坐标归一化到 `0..1`。日志转发事件用 `VRCBRIDGE ` 前缀（网关路径）或 `VRCBRIDGE_LOCAL `（直连路径）。权威定义见 `packages/protocol/src/index.ts` 和 `docs/03-protocol.md`。

## Status / 状态

Work in progress. Current focus: local loop (mock input -> WebSocket -> Playwright -> Chromium), with media and VRChat-log paths layering on. All package versions are `0.1.0`, workspaces marked `private`.

进行中。当前聚焦本地闭环（mock 输入 -> WebSocket -> Playwright -> Chromium），媒体流和 VRChat 日志通路逐步接入。所有包版本 `0.1.0`，workspaces 标记为 `private`。

## License / 许可证

No license file present; all rights reserved by default.

<!-- TODO: confirm intended license before any public reuse -->
