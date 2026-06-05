export interface MediaPipelineOptions {
  mediamtxBin: string;
  mediamtxConfig: string;
  ffmpegBin: string;
  rtspUrl: string;
  capture: string;
  framerate: number;
  width: number;
  encoder: "libx264" | "h264_nvenc";
  preset: string;
  controlUrl?: string;
  profilePollMs: number;
  dryRun: boolean;
  skipMediamtx: boolean;
}

export function parseArgs(argv: string[]): MediaPipelineOptions {
  const options: MediaPipelineOptions = {
    mediamtxBin: "mediamtx",
    mediamtxConfig: "infra/mediamtx/mediamtx.yml",
    ffmpegBin: "ffmpeg",
    rtspUrl: "rtsp://127.0.0.1:8554/browser",
    capture: "desktop",
    framerate: 30,
    width: 1280,
    encoder: "libx264",
    preset: "ultrafast",
    controlUrl: undefined,
    profilePollMs: 1000,
    dryRun: false,
    skipMediamtx: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--mediamtx-bin":
        options.mediamtxBin = requireValue(arg, next);
        index += 1;
        break;
      case "--mediamtx-config":
        options.mediamtxConfig = requireValue(arg, next);
        index += 1;
        break;
      case "--ffmpeg-bin":
        options.ffmpegBin = requireValue(arg, next);
        index += 1;
        break;
      case "--rtsp-url":
        options.rtspUrl = requireValue(arg, next);
        index += 1;
        break;
      case "--capture":
        options.capture = requireValue(arg, next);
        index += 1;
        break;
      case "--framerate":
        options.framerate = parsePositiveInteger(arg, next);
        index += 1;
        break;
      case "--width":
        options.width = parsePositiveInteger(arg, next);
        index += 1;
        break;
      case "--encoder":
        options.encoder = parseEncoder(requireValue(arg, next));
        index += 1;
        break;
      case "--preset":
        options.preset = requireValue(arg, next);
        index += 1;
        break;
      case "--control-url":
        options.controlUrl = requireValue(arg, next).replace(/\/$/, "");
        index += 1;
        break;
      case "--profile-poll-ms":
        options.profilePollMs = parsePositiveInteger(arg, next);
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--skip-mediamtx":
        options.skipMediamtx = true;
        break;
      case "--help":
      case "-h":
        printHelpAndExit();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(name: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parsePositiveInteger(name: string, value: string | undefined): number {
  const parsed = Number.parseInt(requireValue(name, value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseEncoder(value: string): "libx264" | "h264_nvenc" {
  if (value === "libx264" || value === "h264_nvenc") {
    return value;
  }
  throw new Error("--encoder must be libx264 or h264_nvenc");
}

function printHelpAndExit(): never {
  console.log(`VRC Browser Bridge Media Pipeline

Usage:
  npm.cmd run media -- --dry-run
  npm.cmd run media -- --mediamtx-bin C:\\tools\\mediamtx.exe --ffmpeg-bin C:\\tools\\ffmpeg.exe

Options:
  --mediamtx-bin <path>     MediaMTX executable. Default: mediamtx
  --mediamtx-config <path>  MediaMTX config. Default: infra/mediamtx/mediamtx.yml
  --ffmpeg-bin <path>       FFmpeg executable. Default: ffmpeg
  --rtsp-url <url>          RTSP publish URL. Default: rtsp://127.0.0.1:8554/browser
  --capture <source>        Windows gdigrab source: desktop or title=<window title>. Default: desktop
  --framerate <fps>         Capture FPS. Default: 30
  --width <pixels>          Output width. Default: 1280
  --encoder <name>          libx264 or h264_nvenc. Default: libx264
  --preset <name>           Encoder preset. Default: ultrafast
  --control-url <url>       Poll control server stream_profile events, e.g. http://127.0.0.1:8787
  --profile-poll-ms <ms>    Profile polling interval. Default: 1000
  --skip-mediamtx           Do not start MediaMTX; publish to an already-running server.
  --dry-run                 Print commands without starting processes.
`);
  process.exit(0);
}
