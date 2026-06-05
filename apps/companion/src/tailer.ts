import { open, stat } from "node:fs/promises";
import { watch } from "node:fs";

export interface TailFileOptions {
  path: string;
  fromStart: boolean;
  onLine: (line: string) => void;
  onError: (error: Error) => void;
}

export async function tailFile(options: TailFileOptions): Promise<() => Promise<void>> {
  let offset = options.fromStart ? 0 : (await stat(options.path)).size;
  let remainder = "";
  let reading = false;
  let closed = false;

  async function readNewBytes(): Promise<void> {
    if (reading || closed) {
      return;
    }

    reading = true;
    try {
      const fileStat = await stat(options.path);
      if (fileStat.size < offset) {
        offset = 0;
        remainder = "";
      }

      if (fileStat.size === offset) {
        return;
      }

      const handle = await open(options.path, "r");
      try {
        const length = fileStat.size - offset;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, offset);
        offset = fileStat.size;
        consume(buffer.toString("utf8"));
      } finally {
        await handle.close();
      }
    } catch (error) {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      reading = false;
    }
  }

  function consume(chunk: string): void {
    const lines = (remainder + chunk).split(/\r?\n/);
    remainder = lines.pop() ?? "";
    for (const line of lines) {
      options.onLine(line);
    }
  }

  const watcher = watch(options.path, () => {
    void readNewBytes();
  });

  await readNewBytes();

  const interval = setInterval(() => {
    void readNewBytes();
  }, 1000);

  return async () => {
    closed = true;
    clearInterval(interval);
    watcher.close();
  };
}
