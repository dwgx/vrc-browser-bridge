import type { MediaPipelineOptions } from "./args.js";

export function buildMediamtxCommand(options: MediaPipelineOptions): { command: string; args: string[] } {
  return {
    command: options.mediamtxBin,
    args: [options.mediamtxConfig]
  };
}

export function buildFfmpegCommand(options: MediaPipelineOptions): { command: string; args: string[] } {
  const videoArgs = options.encoder === "h264_nvenc"
    ? ["-c:v", "h264_nvenc", "-preset", options.preset, "-tune", "ll", "-bf", "0", "-g", String(options.framerate)]
    : ["-c:v", "libx264", "-preset", options.preset, "-tune", "zerolatency", "-bf", "0", "-g", String(options.framerate)];

  return {
    command: options.ffmpegBin,
    args: [
      "-hide_banner",
      "-loglevel", "info",
      "-f", "gdigrab",
      "-framerate", String(options.framerate),
      "-i", options.capture,
      "-vf", `scale=${options.width}:-2`,
      "-pix_fmt", "yuv420p",
      ...videoArgs,
      "-an",
      "-f", "rtsp",
      "-rtsp_transport", "tcp",
      options.rtspUrl
    ]
  };
}

export function formatCommand(command: string, args: string[]): string {
  return [command, ...args.map(quoteArg)].join(" ");
}

function quoteArg(arg: string): string {
  if (/^[A-Za-z0-9_./:=\\-]+$/.test(arg)) {
    return arg;
  }
  return `"${arg.replaceAll("\"", "\\\"")}"`;
}
