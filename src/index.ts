import { resolve } from "node:path";

const VERSION = "0.1.0";
const REPO_ROOT = resolve(import.meta.dir, "..");
const BANNER_LINES = [
  "  .-=========-.",
  "  `-=======-'",
  "  /  eve    \\",
  " |  armor   |",
  "  \\ shield /",
  "   `-.__.-'",
];

const colors = {
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
} as const;

class CliError extends Error {
  constructor(message: string, readonly exitCode = 1) {
    super(message);
  }
}

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function colorize(text: string, ...styles: string[]) {
  return styles.join("") + text + colors.reset;
}

function formatCommand(command: string[]) {
  return "$ " + command.join(" ");
}

function printBanner() {
  const lines = [...BANNER_LINES];
  lines[2] = lines[2].replace("eve", colorize("eve", colors.bold, colors.cyan));
  lines[3] = lines[3].replace("armor", colorize("armor", colors.bold, colors.blue));
  lines[4] = lines[4].replace("shield", colorize("shield", colors.yellow));
  console.log(lines.join("\n"));
}

function printSuccess(message: string) {
  console.log(colorize("✓ " + message, colors.green));
}

function printWarning(message: string) {
  console.log(colorize("! " + message, colors.yellow));
}

function printError(message: string) {
  console.error(colorize("✗ " + message, colors.red));
}

function printCheck(label: string, value: string, status: "ok" | "warn" = "ok") {
  const marker = status === "ok"
    ? colorize("✓", colors.green)
    : colorize("!", colors.yellow);
  console.log(marker + " " + colorize(label, colors.bold) + ": " + value);
}

function runCommand(
  command: string[],
  options: { allowFailure?: boolean; quiet?: boolean } = {},
): CommandResult {
  if (!options.quiet) {
    console.log(colorize(formatCommand(command), colors.cyan, colors.dim));
  }

  const proc = Bun.spawnSync(command, {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = proc.stdout.toString();
  const stderr = proc.stderr.toString();

  if (proc.success || options.allowFailure) {
    return { exitCode: proc.exitCode, stdout, stderr };
  }

  throw new CliError(stderr.trim() || "Command failed: " + command[0]);
}

function runStreamingCommand(command: string[], description: string) {
  console.log(colorize(formatCommand(command), colors.cyan, colors.dim));
  const proc = Bun.spawnSync(command, {
    cwd: REPO_ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (proc.exitCode !== 0) {
    throw new CliError("Failed: " + description);
  }

  printSuccess(description);
}

function printHelp() {
  printBanner();
  console.log("");
  console.log("Usage: eve <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  " + colorize("setup", colors.bold) + "    Install deps and link eve globally");
  console.log("  " + colorize("doctor", colors.bold) + "   Show version, bin resolution, and repo diagnostics");
  console.log("  " + colorize("help", colors.bold) + "     Show this help");
  console.log("");
  console.log("Flags:");
  console.log("  " + colorize("-h, --help", colors.bold) + "       Show help");
  console.log("  " + colorize("-V, --version", colors.bold) + "    Show version");
}

function hasHelpFlag(args: string[]) {
  return args.includes("--help") || args.includes("-h");
}

function hasVersionFlag(args: string[]) {
  return args.includes("--version") || args.includes("-V");
}

function doctor() {
  printBanner();
  console.log("");

  const bunVersion = runCommand(["bun", "--version"], {
    allowFailure: true,
    quiet: true,
  });
  const whichEve = runCommand(["which", "eve"], {
    allowFailure: true,
    quiet: true,
  });
  const gitStatus = runCommand(["git", "status", "--short"], {
    allowFailure: true,
    quiet: true,
  });

  printCheck("eve version", VERSION);
  printCheck("repo root", REPO_ROOT);

  if (bunVersion.exitCode === 0) {
    printCheck("bun version", bunVersion.stdout.trim());
  } else {
    printCheck("bun version", "bun is not available on PATH", "warn");
  }

  if (whichEve.exitCode === 0) {
    printCheck("eve bin", whichEve.stdout.trim());
  } else {
    printCheck("eve bin", "not linked", "warn");
  }

  if (gitStatus.exitCode === 0) {
    const summary = gitStatus.stdout.trim() || "clean";
    printCheck("git status", summary);
  } else {
    printCheck("git status", "unavailable", "warn");
  }

  if (Bun.file(resolve(REPO_ROOT, "package.json")).size > 0) {
    printCheck("package.json", "present");
  } else {
    printCheck("package.json", "missing", "warn");
  }

  const expectedBin = resolve(Bun.env.HOME ?? "", ".bun/bin/eve");
  if (whichEve.exitCode !== 0 || whichEve.stdout.trim() !== expectedBin) {
    printWarning("eve may need to be re-linked with bun link from this repo.");
  }
}

function setup() {
  printBanner();
  console.log("");
  runStreamingCommand(["bun", "install"], "installed dependencies");
  runStreamingCommand(["bun", "link"], "linked eve globally");
}

export async function runCli(args: string[]) {
  try {
    if (args.length === 0 || hasHelpFlag(args)) {
      printHelp();
      return 0;
    }

    if (hasVersionFlag(args)) {
      console.log(VERSION);
      return 0;
    }

    const command = args[0];

    switch (command) {
      case "setup":
        setup();
        return 0;
      case "doctor":
        doctor();
        return 0;
      case "help":
        printHelp();
        return 0;
      default:
        throw new CliError("Unknown command: " + command);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printError(message);
    return error instanceof CliError ? error.exitCode : 1;
  }
}
