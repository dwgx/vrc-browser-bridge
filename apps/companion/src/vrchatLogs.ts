import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export async function findNewestVrchatLog(): Promise<string> {
  const logDir = join(homedir(), "AppData", "LocalLow", "VRChat", "VRChat");
  const entries = await readdir(logDir);
  const candidates = entries.filter((entry) => /^output_log_.*\.txt$/i.test(entry));

  if (candidates.length === 0) {
    throw new Error(`No VRChat output_log_*.txt files found in ${logDir}`);
  }

  const withStats = await Promise.all(
    candidates.map(async (entry) => {
      const path = join(logDir, entry);
      return {
        path,
        mtimeMs: (await stat(path)).mtimeMs
      };
    })
  );

  withStats.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return withStats[0].path;
}
