export interface CompanionOptions {
  controlUrl: string;
  sessionId: string;
  tailFile?: string;
  tailVrchat: boolean;
  fromStart: boolean;
  playerId: string;
  source: "gateway" | "direct";
}

export function parseArgs(argv: string[]): CompanionOptions {
  const options: CompanionOptions = {
    controlUrl: "ws://127.0.0.1:8787",
    sessionId: "demo",
    tailVrchat: false,
    fromStart: false,
    playerId: "companion-host",
    source: "gateway"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--control":
        options.controlUrl = requireValue(arg, next);
        index += 1;
        break;
      case "--session":
        options.sessionId = requireValue(arg, next);
        index += 1;
        break;
      case "--tail-file":
        options.tailFile = requireValue(arg, next);
        index += 1;
        break;
      case "--tail-vrchat":
        options.tailVrchat = true;
        break;
      case "--from-start":
        options.fromStart = true;
        break;
      case "--player-id":
        options.playerId = requireValue(arg, next);
        index += 1;
        break;
      case "--source":
        options.source = parseSource(requireValue(arg, next));
        index += 1;
        break;
      case "--help":
      case "-h":
        printHelpAndExit();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.tailFile && !options.tailVrchat) {
    options.tailVrchat = true;
  }

  return options;
}

function requireValue(name: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseSource(value: string): "gateway" | "direct" {
  if (value === "gateway" || value === "direct") {
    return value;
  }
  throw new Error("--source must be gateway or direct");
}

function printHelpAndExit(): never {
  console.log(`VRC Browser Bridge Companion

Usage:
  npm.cmd run companion -- --tail-file .\\fake-output.log
  npm.cmd run companion -- --tail-vrchat

Options:
  --control <ws-url>       Control server URL. Default: ws://127.0.0.1:8787
  --session <id>           Default sessionId when log event omits it. Default: demo
  --tail-file <path>       Tail a specific log file.
  --tail-vrchat            Tail the newest VRChat output_log_*.txt.
  --from-start             Replay existing file content before following new lines.
  --player-id <id>         Default playerId when log event omits it. Default: companion-host
  --source <gateway|direct> Default source when log event omits it. Default: gateway
`);
  process.exit(0);
}
