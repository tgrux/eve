import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { homedir } from "node:os";

const VERSION = "0.1.0";
const REPO_ROOT = resolve(import.meta.dir, "..");
const HOME = homedir();
const BANNER_LINES = [
  "+----------------------+",
  "| eve - ai tooling cli |",
  "+----------------------+",
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

type AiToolsOptions = {
  agent?: "claude" | "codex";
};

function colorize(text: string, ...styles: string[]) {
  return styles.join("") + text + colors.reset;
}

function formatCommand(command: string[]) {
  return "$ " + command.join(" ");
}

function printBanner() {
  const lines = [...BANNER_LINES];
  lines[1] = lines[1]
    .replace("eve", colorize("eve", colors.bold, colors.cyan))
    .replace("ai tooling cli", colorize("ai tooling cli", colors.bold, colors.blue));
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
  const marker = status === "ok" ? colorize("✓", colors.green) : colorize("!", colors.yellow);
  console.log(marker + " " + colorize(label, colors.bold) + ": " + value);
}

function printSection(title: string) {
  console.log("");
  console.log(colorize(title, colors.bold, colors.cyan));
}

function formatList(items: string[]) {
  return items.length > 0 ? items.join(", ") : "none";
}

function printTable(rows: Array<[string, string]>) {
  const width = rows.reduce((max, [label]) => Math.max(max, label.length), 0);
  for (const [label, value] of rows) {
    const padded = label.padEnd(width, " ");
    const renderedValue = value === "none"
      ? colorize(value, colors.dim)
      : colorize(value, colors.green);
    console.log("  " + colorize(padded, colors.bold, colors.yellow) + "  " + renderedValue);
  }
}

function runCommand(command: string[], options: { allowFailure?: boolean; quiet?: boolean } = {}): CommandResult {
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

function readJsonFile(path: string) {
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function readTomlFile(path: string) {
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return Bun.TOML.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function listFiles(root: string, matcher: (path: string) => boolean) {
  const results: string[] = [];
  if (!existsSync(root)) {
    return results;
  }

  const walk = (current: string) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (matcher(fullPath)) {
        results.push(fullPath);
      }
    }
  };

  walk(root);
  results.sort();
  return results;
}

function pathLabel(root: string, path: string) {
  return (relative(root, path) || basename(path)).replace(/\\/g, "/");
}

function commandLabel(path: string, root: string) {
  const relativePath = relative(root, path);
  const withoutExtension = relativePath.slice(0, relativePath.length - extname(relativePath).length);
  return "/" + withoutExtension.split("/").join(":");
}

function unique(items: string[]) {
  return [...new Set(items)].sort();
}

function extractMcpNames(config: Record<string, unknown> | undefined) {
  if (!config) {
    return [] as string[];
  }

  const mcpServers = config.mcp_servers;
  if (mcpServers && typeof mcpServers === "object") {
    return Object.keys(mcpServers as Record<string, unknown>).sort();
  }

  const altServers = (config as { mcpServers?: Record<string, unknown> }).mcpServers;
  if (altServers && typeof altServers === "object") {
    return Object.keys(altServers).sort();
  }

  return Object.entries(config)
    .filter(([key, value]) => {
      if (key.startsWith("_")) {
        return false;
      }
      if (!value || typeof value !== "object") {
        return false;
      }
      const candidate = value as Record<string, unknown>;
      return Boolean(candidate.command || candidate.args || candidate.url || candidate.type || candidate.config);
    })
    .map(([key]) => key)
    .sort();
}

function extractClaudeHooks(settings: Record<string, unknown> | undefined) {
  const hooks = settings && typeof settings.hooks === "object" ? settings.hooks as Record<string, unknown> : {};
  return Object.entries(hooks)
    .flatMap(([eventName, rules]) => {
      if (!Array.isArray(rules)) {
        return [] as string[];
      }
      return rules.flatMap((rule) => {
        if (!rule || typeof rule !== "object") {
          return [] as string[];
        }
        const hookList = Array.isArray((rule as { hooks?: unknown[] }).hooks)
          ? (rule as { hooks: unknown[] }).hooks
          : [];
        return hookList.flatMap((hook) => {
          if (!hook || typeof hook !== "object") {
            return [] as string[];
          }
          const entry = hook as Record<string, unknown>;
          if (typeof entry.command === "string") {
            return [eventName + " -> " + entry.command];
          }
          if (typeof entry.type === "string") {
            return [eventName + " -> " + entry.type];
          }
          return [] as string[];
        });
      });
    })
    .sort();
}

function extractSkills(root: string) {
  return unique(listFiles(root, (path) => basename(path) === "SKILL.md").map((path) => pathLabel(root, dirname(path))));
}

function extractClaudeCommands(roots: string[]) {
  return unique(
    roots.flatMap((root) => listFiles(root, (path) => [".md", ".txt"].includes(extname(path))).map((path) => commandLabel(path, root))),
  );
}

function detectInstalledAgents() {
  const agents: Array<"claude" | "codex"> = [];
  if (existsSync(join(HOME, ".claude")) || existsSync(join(process.cwd(), ".claude"))) {
    agents.push("claude");
  }
  if (existsSync(join(HOME, ".codex")) || existsSync(join(process.cwd(), ".codex"))) {
    agents.push("codex");
  }
  return agents;
}

function printScopeHeading(scopeName: string, scopeRoot: string) {
  printSection(scopeName + " (" + scopeRoot + ")");
}

function printClaudeForScope(scopeName: string, scopeRoot: string) {
  const settingsPath = join(scopeRoot, ".claude", "settings.json");
  const settings = readJsonFile(settingsPath);
  const mcpSources = [
    join(scopeRoot, ".mcp.json"),
    join(scopeRoot, ".claude", ".mcp.json"),
    join(scopeRoot, ".claude", "managed-mcp.json"),
  ];
  const commandRoots = [
    join(scopeRoot, ".claude", "commands"),
    join(scopeRoot, ".config", "claude", "commands"),
  ];
  const hookRoot = join(scopeRoot, ".claude", "hooks");
  const skillRoot = join(scopeRoot, ".claude", "skills");

  printScopeHeading(scopeName, scopeRoot);
  printTable([
    ["Config", formatList([settingsPath].filter((path) => existsSync(path)))],
    ["MCPs", formatList(unique(mcpSources.flatMap((source) => extractMcpNames(readJsonFile(source)))))],
    ["Hooks", formatList(extractClaudeHooks(settings))],
    ["Hook files", formatList(listFiles(hookRoot, () => true).map((path) => pathLabel(hookRoot, path)))],
    ["Skills", formatList(extractSkills(skillRoot))],
    ["Slash commands", formatList(extractClaudeCommands(commandRoots))],
  ]);
}

function printCodexForScope(scopeName: string, scopeRoot: string) {
  const configPath = join(scopeRoot, ".codex", "config.toml");
  const config = readTomlFile(configPath);
  const skillRoot = join(scopeRoot, ".codex", "skills");
  const model = config && typeof config.model === "string" ? [String(config.model)] : [];
  const personality = config && typeof config.personality === "string" ? [String(config.personality)] : [];

  printScopeHeading(scopeName, scopeRoot);
  printTable([
    ["Config", formatList([configPath].filter((path) => existsSync(path)))],
    ["Model", formatList(model)],
    ["Personality", formatList(personality)],
    ["MCPs", formatList(extractMcpNames(config))],
    ["Hooks", formatList([])],
    ["Skills", formatList(extractSkills(skillRoot))],
  ]);
}

function parseAiToolsArgs(args: string[]): AiToolsOptions {
  let agent: "claude" | "codex" | undefined;
  for (const arg of args) {
    if (arg === "claude" || arg === "codex") {
      if (agent) {
        throw new CliError("Specify only one agent for tools.");
      }
      agent = arg;
      continue;
    }
    throw new CliError("Unknown tools argument: " + arg);
  }

  return { agent };
}

function aiTools(args: string[]) {
  const options = parseAiToolsArgs(args);
  const agents = options.agent ? [options.agent] : detectInstalledAgents();

  printBanner();
  console.log("");

  if (agents.length === 0) {
    printWarning("No Claude or Codex config was detected globally or in the current directory.");
    return;
  }

  const scopes = [
    { label: "Global", root: HOME },
    { label: "CWD", root: process.cwd() },
  ];

  for (const agent of agents) {
    printSection(agent === "claude" ? "Claude" : "Codex");
    for (const scope of scopes) {
      if (agent === "claude") {
        printClaudeForScope(scope.label, scope.root);
      } else {
        printCodexForScope(scope.label, scope.root);
      }
    }
  }
}

function printHelp() {
  printBanner();
  console.log("");
  console.log("Usage: eve <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  " + colorize("setup", colors.bold) + "      Install deps and link eve globally");
  console.log("  " + colorize("doctor", colors.bold) + "     Show version, bin resolution, and repo diagnostics");
  console.log("  " + colorize("tools", colors.bold) + "   List AI tools from global and cwd config");
  console.log("  " + colorize("help", colors.bold) + "       Show this help");
  console.log("");
  console.log("AI tools examples:");
  console.log("  eve tools");
  console.log("  eve tools codex");
  console.log("  eve tools claude");
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

  const bunVersion = runCommand(["bun", "--version"], { allowFailure: true, quiet: true });
  const whichEve = runCommand(["which", "eve"], { allowFailure: true, quiet: true });
  const gitStatus = runCommand(["git", "status", "--short"], { allowFailure: true, quiet: true });
  const packagePresent = Bun.file(resolve(REPO_ROOT, "package.json")).size > 0;

  printCheck("eve version", VERSION);
  printCheck("repo root", REPO_ROOT);
  printCheck("bun version", bunVersion.exitCode === 0 ? bunVersion.stdout.trim() : "bun is not available on PATH", bunVersion.exitCode === 0 ? "ok" : "warn");
  printCheck("eve bin", whichEve.exitCode === 0 ? whichEve.stdout.trim() : "not linked", whichEve.exitCode === 0 ? "ok" : "warn");
  printCheck("git status", gitStatus.exitCode === 0 ? (gitStatus.stdout.trim() || "clean") : "unavailable", gitStatus.exitCode === 0 ? "ok" : "warn");
  printCheck("package.json", packagePresent ? "present" : "missing", packagePresent ? "ok" : "warn");

  const expectedBin = resolve(Bun.env.HOME ?? "", ".bun/bin/eve");
  if (whichEve.exitCode !== 0 || whichEve.stdout.trim() !== expectedBin) {
    printWarning("eve may need to be re linked with bun link from this repo.");
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
    const rest = args.slice(1);

    switch (command) {
      case "setup":
        setup();
        return 0;
      case "doctor":
        doctor();
        return 0;
      case "tools":
        aiTools(rest);
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
