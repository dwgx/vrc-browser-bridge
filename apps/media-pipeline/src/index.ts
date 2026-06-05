import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "./args.js";
import { buildFfmpegCommand, buildMediamtxCommand, formatCommand } from "./commands.js";
import { startManagedProcess, type ManagedProcess } from "./processRunner.js";

const options = parseArgs(process.argv.slice(2));
options.mediamtxConfig = resolve(options.mediamtxConfig);

const mediamtx = buildMediamtxCommand(options);
let ffmpeg = buildFfmpegCommand(options);

console.log("VRC Browser Bridge Media Pipeline");
console.log(`RTSP publish URL: ${options.rtspUrl}`);
console.log(`VRChat/AVPro URL: ${options.rtspUrl}`);
console.log(`MediaMTX: ${options.skipMediamtx ? "external/already running" : formatCommand(mediamtx.command, mediamtx.args)}`);
console.log(`FFmpeg: ${formatCommand(ffmpeg.command, ffmpeg.args)}`);

if (options.dryRun) {
  process.exit(0);
}

const missing: string[] = [];
if (!(await isExecutableAvailable(options.ffmpegBin))) {
  missing.push(`ffmpeg executable not found: ${options.ffmpegBin}. Pass --ffmpeg-bin <path> or add it to PATH.`);
}

if (!options.skipMediamtx) {
  await access(options.mediamtxConfig);
  if (!(await isExecutableAvailable(options.mediamtxBin))) {
    missing.push(`MediaMTX executable not found: ${options.mediamtxBin}. Pass --mediamtx-bin <path> or add it to PATH.`);
  }
}

if (missing.length > 0) {
  throw new Error(missing.join("\n"));
}

const processes: ManagedProcess[] = [];
let ffmpegProcess: ManagedProcess | undefined;
let profilePollTimer: NodeJS.Timeout | undefined;
let lastMediaEventId = 0;

if (!options.skipMediamtx) {
  processes.push(startManagedProcess("mediamtx", mediamtx.command, mediamtx.args));
  await sleep(1200);
}

ffmpegProcess = startManagedProcess("ffmpeg", ffmpeg.command, ffmpeg.args);
processes.push(ffmpegProcess);

console.log("media pipeline running");
console.log("Open this in VLC or VRChat AVPro:");
console.log(options.rtspUrl);

if (options.controlUrl) {
  console.log(`stream profile control: ${options.controlUrl}/media-control/events`);
  startProfilePolling();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

async function shutdown(): Promise<void> {
  console.log("shutting down media pipeline");
  clearInterval(profilePollTimer);
  for (const processInfo of processes.reverse()) {
    await processInfo.stop();
  }
  process.exit(0);
}

function startProfilePolling(): void {
  profilePollTimer = setInterval(() => {
    void pollStreamProfile();
  }, options.profilePollMs);
  void pollStreamProfile();
}

async function pollStreamProfile(): Promise<void> {
  if (!options.controlUrl) {
    return;
  }

  try {
    const response = await fetch(`${options.controlUrl}/media-control/events?since=${lastMediaEventId}`);
    const payload = await response.json() as MediaControlResponse;
    if (!payload.ok) {
      return;
    }

    for (const event of payload.events) {
      lastMediaEventId = Math.max(lastMediaEventId, event.id);
      if (event.type === "stream_profile") {
        await applyStreamProfile(event);
      }
    }
  } catch (error) {
    console.warn(`[media-control] ${error instanceof Error ? error.message : "poll failed"}`);
  }
}

async function applyStreamProfile(event: MediaControlEvent): Promise<void> {
  if (options.width === event.mediaWidth) {
    return;
  }

  console.log(`[media-control] switching stream profile to ${event.profile} (${event.mediaWidth}px output)`);
  options.width = event.mediaWidth;
  ffmpeg = buildFfmpegCommand(options);

  if (ffmpegProcess) {
    await ffmpegProcess.stop();
    const index = processes.indexOf(ffmpegProcess);
    if (index >= 0) {
      processes.splice(index, 1);
    }
  }

  ffmpegProcess = startManagedProcess("ffmpeg", ffmpeg.command, ffmpeg.args);
  processes.push(ffmpegProcess);
}

interface MediaControlResponse {
  ok: boolean;
  events: MediaControlEvent[];
}

interface MediaControlEvent {
  id: number;
  type: "stream_profile";
  profile: string;
  mediaWidth: number;
}

async function isExecutableAvailable(command: string): Promise<boolean> {
  if (command.includes("\\") || command.includes("/") || command.endsWith(".exe")) {
    try {
      await access(command);
      return true;
    } catch {
      return false;
    }
  }

  const isWindows = process.platform === "win32";
  const probe = isWindows ? "where.exe" : "which";
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(probe, [command], { stdio: "ignore" });
  return result.status === 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
