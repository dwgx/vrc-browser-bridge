import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";

type ManagedChild = ChildProcessByStdio<null, Readable, Readable>;

export interface ManagedProcess {
  name: string;
  child: ManagedChild;
  stop: () => Promise<void>;
}

export function startManagedProcess(name: string, command: string, args: string[]): ManagedProcess {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  child.stdout.on("data", (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${name}] ${data}`));
  child.on("exit", (code, signal) => {
    console.log(`[${name}] exited code=${code ?? "null"} signal=${signal ?? "null"}`);
  });

  return {
    name,
    child,
    stop: () => stopChild(name, child)
  };
}

async function stopChild(name: string, child: ManagedChild): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.warn(`[${name}] force killing`);
      child.kill("SIGKILL");
      resolve();
    }, 3000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill("SIGTERM");
  });
}
