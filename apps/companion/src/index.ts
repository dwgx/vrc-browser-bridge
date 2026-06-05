import { resolve } from "node:path";
import { parseBridgeLogLine, type BridgeEvent } from "@vrcbb/protocol";
import { parseArgs } from "./args.js";
import { ControlClient } from "./controlClient.js";
import { tailFile } from "./tailer.js";
import { findNewestVrchatLog } from "./vrchatLogs.js";

const options = parseArgs(process.argv.slice(2));
const logPath = resolve(options.tailFile ?? (await findNewestVrchatLog()));

console.log("VRC Browser Bridge Companion");
console.log(`tailing ${logPath}`);
console.log(`control ${options.controlUrl}`);
console.log(`session ${options.sessionId}`);

const client = new ControlClient({
  url: options.controlUrl,
  onStatus: (message) => console.log(`[control] ${message}`)
});
client.start();

const stopTail = await tailFile({
  path: logPath,
  fromStart: options.fromStart,
  onLine: (line) => handleLine(line),
  onError: (error) => console.error(`[tail] ${error.message}`)
});

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

function handleLine(line: string): void {
  const parsed = parseBridgeLogLine(line.trimStart());
  if (parsed === null) {
    return;
  }

  if (!parsed.ok) {
    console.error(`[protocol] rejected log line: ${parsed.error}`);
    return;
  }

  const event = applyDefaults(parsed.value);
  client.send(event);
  console.log(`[forward] ${event.type} #${event.seq} ${event.sessionId}/${event.playerId ?? "anonymous"}`);
}

function applyDefaults(event: BridgeEvent): BridgeEvent {
  return {
    ...event,
    sessionId: event.sessionId || options.sessionId,
    playerId: event.playerId ?? options.playerId,
    source: event.source ?? options.source,
    ts: event.ts ?? Date.now()
  };
}

async function shutdown(): Promise<void> {
  console.log("shutting down companion");
  await stopTail();
  client.stop();
  process.exit(0);
}
