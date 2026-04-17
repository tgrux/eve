import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { stdin as input, stdout as output } from "node:process";

const VERSION = "0.1.0";
const REPO_ROOT = resolve(import.meta.dir, "..");
const RESOURCES_ROOT = join(REPO_ROOT, "resources");
const RESOURCE_COMMANDS_ROOT = join(RESOURCES_ROOT, "commands");
const RESOURCE_HOOK_FILES_ROOT = join(RESOURCES_ROOT, "hooks");
const RESOURCE_MCPS_ROOT = join(RESOURCES_ROOT, "mcps");
const RESOURCE_SKILLS_ROOT = join(RESOURCES_ROOT, "skills");
const RESOURCE_PERMISSIONS_ROOT = join(RESOURCES_ROOT, "permissions");
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

type EveConfig = {
  skillRoots: string[];
};

type Choice<T extends string> = {
  value: T;
  label: string;
  description?: string;
  selectable?: boolean;
};

type HookCatalogEntry = {
  name?: string;
  description?: string;
  hooks?: Record<string, unknown>;
};

type McpCatalogEntry = {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
};

type InstalledHook = {
  eventName: string;
  label: string;
  rule: unknown;
  folderKey?: string;
};

type DoctorRow = {
  label: string;
  value: string;
  note?: string;
};

type SkillCatalogEntry = {
  key: string;
  skill: string;
  sourceRoot: string;
  sourcePath: string;
  description: string;
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

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function doctorStatus(value: boolean) {
  return value
    ? colorize("yes", colors.green, colors.bold)
    : colorize("no", colors.red, colors.bold);
}

function printDoctorSection(title: string, rows: DoctorRow[]) {
  const labelWidth = Math.max(...rows.map((row) => row.label.length), 0);
  console.log(colorize(title, colors.bold));
  for (const row of rows) {
    console.log(`  ${colorize(row.label.padEnd(labelWidth), colors.dim)}  ${row.value}`);
    if (row.note) {
      console.log(`  ${" ".repeat(labelWidth)}  ${colorize(row.note, colors.dim)}`);
    }
  }
  console.log("");
}

function printTable(rows: Array<[string, string[]]>) {
  const anyDefined = rows.some(([, items]) => items.length > 0);
  if (!anyDefined) {
    console.log("  " + colorize("nothing defined", colors.dim));
    return;
  }
  const width = rows.reduce((max, [label]) => Math.max(max, label.length), 0);
  for (const [label, items] of rows) {
    const padded = label.padEnd(width, " ");
    if (items.length === 0) {
      console.log("  " + colorize(padded, colors.bold, colors.yellow) + "  " + colorize("none", colors.dim));
    } else {
      console.log("  " + colorize(padded, colors.bold, colors.yellow) + "  " + colorize(items[0], colors.green));
      const indent = "  " + " ".repeat(width) + "  ";
      for (const item of items.slice(1)) {
        console.log(indent + colorize(item, colors.green));
      }
    }
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

function writeJsonFile(path: string, value: unknown) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function isTomlPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isTomlArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.every((item) => isTomlPrimitive(item));
}

function isTomlTable(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatTomlKey(key: string) {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function formatTomlValue(value: string | number | boolean | unknown[]): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return `[${value.map((item) => formatTomlValue(item as string | number | boolean | unknown[])).join(", ")}]`;
}

function serializeTomlTable(path: string[], table: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const scalarEntries = Object.entries(table).filter(([, value]) => isTomlPrimitive(value) || isTomlArray(value));
  const childTables = Object.entries(table).filter(([, value]) => isTomlTable(value));

  if (path.length > 0) {
    lines.push(`[${path.map((segment) => formatTomlKey(segment)).join(".")}]`);
  }

  for (const [key, value] of scalarEntries) {
    lines.push(`${formatTomlKey(key)} = ${formatTomlValue(value as string | number | boolean | unknown[])}`);
  }

  if (scalarEntries.length > 0 && childTables.length > 0) {
    lines.push("");
  }

  childTables.forEach(([key, value], index) => {
    lines.push(...serializeTomlTable([...path, key], value as Record<string, unknown>));
    if (index < childTables.length - 1) {
      lines.push("");
    }
  });

  return lines;
}

function writeTomlFile(path: string, value: Record<string, unknown>) {
  ensureDir(dirname(path));
  const lines = serializeTomlTable([], value);
  writeFileSync(path, (lines.join("\n").trimEnd() + "\n"), "utf8");
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
      let isDir = entry.isDirectory();
      if (!isDir && entry.isSymbolicLink()) {
        try { isDir = statSync(fullPath).isDirectory(); } catch { /* broken symlink */ }
      }
      if (isDir) {
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

function getEveConfigPaths() {
  const paths = [join(HOME, ".config", "eve", "config.json"), join(process.cwd(), ".eve", "config.json")];
  return unique(paths);
}

function parseConfiguredPathArray(value: unknown, configPath: string) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return unique(
    value.flatMap((entry) => {
      if (typeof entry !== "string" || entry.trim().length === 0) {
        return [] as string[];
      }
      return [resolve(dirname(configPath), entry.trim())];
    }),
  );
}

function readEveConfig(): EveConfig {
  const skillRoots: string[] = [];

  for (const configPath of getEveConfigPaths()) {
    const config = readJsonFile(configPath);
    if (!config) {
      continue;
    }
    skillRoots.push(...parseConfiguredPathArray(config.skillRoots, configPath));
  }

  return {
    skillRoots: unique(skillRoots),
  };
}

function ensureDir(path: string) {
  mkdirSync(path, { recursive: true });
}

async function prompt(question: string) {
  process.stdout.write(question);
  input.resume();
  input.setEncoding("utf8");

  return await new Promise<string>((resolvePrompt) => {
    const onData = (chunk: string) => {
      input.off("data", onData);
      resolvePrompt(chunk.replace(/\r?\n$/, "").trim());
    };
    input.on("data", onData);
  });
}

function clearRenderedLines(count: number) {
  for (let index = 0; index < count; index += 1) {
    output.write("[1A");
    output.write("[2K");
  }
}

function findNextSelectableIndex<T extends string>(choices: Choice<T>[], start: number, direction: 1 | -1) {
  let cursor = start;
  for (let steps = 0; steps < choices.length; steps += 1) {
    cursor = (cursor + direction + choices.length) % choices.length;
    if (choices[cursor]?.selectable !== false) {
      return cursor;
    }
  }
  return start;
}

async function runPicker<T extends string>(
  question: string,
  choices: Choice<T>[],
  options: { multi: boolean },
) {
  if (choices.length === 0) {
    return [] as T[];
  }

  if (!input.isTTY || !output.isTTY) {
    throw new CliError("Interactive selection requires a TTY.");
  }

  let cursor = choices.findIndex((choice) => choice.selectable !== false);
  if (cursor === -1) {
    return [] as T[];
  }
  const selected = new Set<number>();

  const render = () => {
    const lines = [
      question,
      colorize(
        options.multi
          ? "Use ↑/↓ to move, space to toggle, enter to confirm, q to cancel."
          : "Use ↑/↓ to move, enter to confirm, q to cancel.",
        colors.dim,
      ),
      ...choices.map((choice, index) => {
        if (choice.selectable === false) {
          return colorize("  " + choice.label, colors.bold, colors.blue);
        }
        const pointer = index === cursor ? colorize("›", colors.cyan, colors.bold) : " ";
        const marker = options.multi
          ? selected.has(index) ? colorize("[x]", colors.green, colors.bold) : colorize("[ ]", colors.dim)
          : index === cursor ? colorize("(•)", colors.green, colors.bold) : colorize("( )", colors.dim);
        const label = index === cursor ? colorize(choice.label, colors.bold, colors.cyan) : choice.label;
        const suffix = choice.description ? colorize(" - " + choice.description, colors.dim) : "";
        return `${pointer} ${marker} ${label}${suffix}`;
      }),
    ];
    output.write(lines.join("\n") + "\n");
    return lines.length;
  };

  let renderedLines = render();

  return await new Promise<T[]>((resolvePicker, rejectPicker) => {
    const finish = (value: T[]) => {
      input.setRawMode?.(false);
      input.pause();
      input.off("data", onData);
      clearRenderedLines(renderedLines);
      resolvePicker(value);
    };

    const fail = (error: Error) => {
      input.setRawMode?.(false);
      input.pause();
      input.off("data", onData);
      clearRenderedLines(renderedLines);
      rejectPicker(error);
    };

    const rerender = () => {
      clearRenderedLines(renderedLines);
      renderedLines = render();
    };

    const onData = (chunk: Buffer | string) => {
      const key = chunk.toString("utf8");

      if (key === "") {
        fail(new CliError("Selection cancelled.", 130));
        return;
      }

      if (key === "q" || key === "Q") {
        finish([]);
        return;
      }

      if (key === "[A") {
        cursor = findNextSelectableIndex(choices, cursor, -1);
        rerender();
        return;
      }

      if (key === "[B") {
        cursor = findNextSelectableIndex(choices, cursor, 1);
        rerender();
        return;
      }

      if (options.multi && key === " ") {
        if (selected.has(cursor)) {
          selected.delete(cursor);
        } else {
          selected.add(cursor);
        }
        rerender();
        return;
      }

      if (key === "\r") {
        if (options.multi) {
          finish([...selected].sort((left, right) => left - right).map((index) => choices[index]!.value));
        } else {
          finish([choices[cursor]!.value]);
        }
      }
    };

    input.setRawMode?.(true);
    input.resume();
    input.on("data", onData);
  });
}

async function selectOne<T extends string>(question: string, choices: Choice<T>[]) {
  const selected = await runPicker(question, choices, { multi: false });
  if (selected.length === 0) {
    throw new CliError("Selection cancelled.");
  }
  return selected[0]!;
}

async function selectMany<T extends string>(question: string, choices: Choice<T>[]) {
  return await runPicker(question, choices, { multi: true });
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
            return [colorize(eventName, colors.cyan) + colors.green + " -> " + entry.command];
          }
          if (typeof entry.type === "string") {
            return [colorize(eventName, colors.cyan) + colors.green + " -> " + entry.type];
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

function formatSkillSourceDescription(root: string, skill: string) {
  if (root === RESOURCE_SKILLS_ROOT) {
    return "resources/skills/" + skill;
  }
  return join(root, skill).replace(/\\/g, "/");
}

function getSkillCatalog() {
  const config = readEveConfig();
  const roots = unique([RESOURCE_SKILLS_ROOT, ...config.skillRoots]);
  const entries: SkillCatalogEntry[] = [];

  for (const root of roots) {
    for (const skill of extractSkills(root)) {
      const sourcePath = join(root, skill);
      entries.push({
        key: JSON.stringify([root, skill]),
        skill,
        sourceRoot: root,
        sourcePath,
        description: formatSkillSourceDescription(root, skill),
      });
    }
  }

  return entries.sort((left, right) =>
    left.skill.localeCompare(right.skill)
    || left.sourceRoot.localeCompare(right.sourceRoot)
  );
}

function getInstalledSkillKeys(baseDir: string): string[] {
  const roots = [join(baseDir, ".claude", "skills"), join(baseDir, ".codex", "skills")];
  const seen = new Set<string>();
  for (const root of roots) {
    if (!existsSync(root)) continue;
    try {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() || entry.isSymbolicLink()) seen.add(entry.name);
      }
    } catch { /* ignore */ }
  }
  return [...seen].sort();
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
    getClaudeMcpFile(scopeRoot),
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
    ["Config", [settingsPath].filter((path) => existsSync(path))],
    ["MCPs", unique(mcpSources.flatMap((source) => extractMcpNames(readJsonFile(source))))],
    ["Hooks", extractClaudeHooks(settings)],
    ["Hook files", listFiles(hookRoot, (path) => [".js", ".py", ".sh", ".ts"].includes(extname(path))).map((path) => pathLabel(hookRoot, path))],
    ["Skills", extractSkills(skillRoot)],
    ["Slash commands", extractClaudeCommands(commandRoots)],
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
    ["Config", [configPath].filter((path) => existsSync(path))],
    ["Model", model],
    ["Personality", personality],
    ["MCPs", extractMcpNames(config)],
    ["Hooks", []],
    ["Skills", extractSkills(skillRoot)],
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

function getCommandChoices(): Choice<string>[] {
  return listFiles(RESOURCE_COMMANDS_ROOT, (path) => extname(path) === ".md").map((path) => ({
    value: pathLabel(RESOURCE_COMMANDS_ROOT, path),
    label: commandLabel(path, RESOURCE_COMMANDS_ROOT),
    description: pathLabel(RESOURCE_COMMANDS_ROOT, path),
  }));
}

function getSkillChoices(): Choice<string>[] {
  return getSkillCatalog().map((entry) => ({
    value: entry.key,
    label: entry.skill,
    description: entry.description,
  }));
}

function getHookCatalog() {
  if (!existsSync(RESOURCE_HOOK_FILES_ROOT)) return {} as Record<string, HookCatalogEntry>;
  const catalog: Record<string, HookCatalogEntry> = {};
  for (const entry of readdirSync(RESOURCE_HOOK_FILES_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const hookJson = readJsonFile(join(RESOURCE_HOOK_FILES_ROOT, entry.name, "hook.json")) as HookCatalogEntry | undefined;
    if (hookJson) catalog[entry.name] = hookJson;
  }
  return catalog;
}

function getHookChoices(): Choice<string>[] {
  const catalog = getHookCatalog();
  return Object.entries(catalog).map(([key, value]) => ({
    value: key,
    label: value.name ?? key,
    description: value.description,
  }));
}

function getMcpCatalog() {
  if (!existsSync(RESOURCE_MCPS_ROOT)) return {} as Record<string, McpCatalogEntry>;
  const catalog: Record<string, McpCatalogEntry> = {};
  for (const entry of readdirSync(RESOURCE_MCPS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const mcpJson = readJsonFile(join(RESOURCE_MCPS_ROOT, entry.name, "mcp.json")) as McpCatalogEntry | undefined;
    if (!mcpJson) continue;
    const isHttpMcp = !mcpJson.config && Object.values(mcpJson).some(
      (v) => typeof v === "object" && v !== null && "type" in v && (v as Record<string, unknown>).type === "http"
    );
    if (mcpJson.config || isHttpMcp) catalog[entry.name] = mcpJson;
  }
  return catalog;
}

function getMcpChoices(): Choice<string>[] {
  const catalog = getMcpCatalog();
  return Object.entries(catalog).map(([key, value]) => ({
    value: key,
    label: value.name ?? key,
    description: key === "slack"
      ? [value.description, "Claude only"].filter(Boolean).join(" - ")
      : value.description,
  }));
}

function getClaudeMcpFile(baseDir: string) {
  return baseDir === HOME ? join(HOME, ".claude.json") : join(baseDir, ".mcp.json");
}

function getCodexConfigFile(baseDir: string) {
  return join(baseDir, ".codex", "config.toml");
}

function getInstalledClaudeMcpKeys(baseDir: string): string[] {
  const config = readJsonFile(getClaudeMcpFile(baseDir)) ?? {};
  const servers = config.mcpServers;
  if (!servers || typeof servers !== "object") return [];
  return Object.keys(servers as Record<string, unknown>).sort();
}

function getInstalledCodexMcpKeys(baseDir: string): string[] {
  const config = readTomlFile(getCodexConfigFile(baseDir)) ?? {};
  return extractMcpNames(config);
}

function getInstalledMcpKeys(baseDir: string): string[] {
  return unique([...getInstalledClaudeMcpKeys(baseDir), ...getInstalledCodexMcpKeys(baseDir)]);
}

async function resolveMcpEntries(selected: string[]) {
  const catalog = getMcpCatalog();
  const placeholderValues: Record<string, string> = {};
  for (const key of selected) {
    const entry = catalog[key];
    if (entry?.config) continue;
    for (const [, serverConfig] of Object.entries(entry)) {
      if (typeof serverConfig !== "object" || serverConfig === null) continue;
      const server = serverConfig as Record<string, unknown>;
      if (server.type !== "http" || !server.headers) continue;
      for (const headerVal of Object.values(server.headers as Record<string, string>)) {
        for (const [, varName] of [...headerVal.matchAll(/\$\{([^}]+)\}/g)]) {
          if (!(varName in placeholderValues)) {
            placeholderValues[varName] = await prompt(`Enter value for ${varName}: `);
          }
        }
      }
    }
  }

  const substitute = (str: string) =>
    str.replace(/\$\{([^}]+)\}/g, (_, v) => placeholderValues[v] ?? `\${${v}}`);

  const resolved: Record<string, unknown> = {};
  for (const key of selected) {
    const entry = catalog[key];
    if (!entry) {
      continue;
    }
    if (entry?.config) {
      resolved[key] = JSON.parse(substitute(JSON.stringify(entry.config)));
    } else {
      for (const [serverKey, serverConfig] of Object.entries(entry)) {
        if (serverKey === "name" || serverKey === "description") continue;
        resolved[serverKey] = JSON.parse(substitute(JSON.stringify(serverConfig)));
      }
    }
  }

  return resolved;
}

function installClaudeMcps(resolvedEntries: Record<string, unknown>, baseDir: string) {
  const mcpFile = getClaudeMcpFile(baseDir);
  const config = readJsonFile(mcpFile) ?? {};
  const configRecord = config as Record<string, unknown>;
  const servers = configRecord.mcpServers && typeof configRecord.mcpServers === "object"
    ? configRecord.mcpServers as Record<string, unknown>
    : {};
  configRecord.mcpServers = servers;

  for (const [key, value] of Object.entries(resolvedEntries)) {
    servers[key] = value;
  }

  writeJsonFile(mcpFile, configRecord);
  return mcpFile;
}

function installCodexMcps(resolvedEntries: Record<string, unknown>, baseDir: string) {
  const configPath = getCodexConfigFile(baseDir);
  const config = readTomlFile(configPath) ?? {};
  const configRecord = config as Record<string, unknown>;
  const servers = configRecord.mcp_servers && typeof configRecord.mcp_servers === "object"
    ? configRecord.mcp_servers as Record<string, unknown>
    : {};
  configRecord.mcp_servers = servers;

  for (const [key, value] of Object.entries(resolvedEntries)) {
    servers[key] = value;
  }

  writeTomlFile(configPath, configRecord);
  return configPath;
}

async function installMcps(selected: string[], baseDir: string) {
  const codexSelected = selected.filter((key) => key !== "slack");
  const claudeEntries = await resolveMcpEntries(selected);
  const claudePath = installClaudeMcps(claudeEntries, baseDir);
  const installedTargets = [claudePath];

  if (codexSelected.length > 0) {
    const codexEntries = codexSelected.length === selected.length
      ? claudeEntries
      : await resolveMcpEntries(codexSelected);
    const codexPath = installCodexMcps(codexEntries, baseDir);
    installedTargets.push(codexPath);
  }

  printSuccess(`Installed ${selected.length} ${pluralize(selected.length, "MCP", "MCPs")} into ${installedTargets.join(" and ")}`);
  if (selected.includes("datadog")) {
    printWarning("Datadog requires Codex OAuth after install: run `codex mcp login datadog`.");
  }
  if (selected.includes("atlassian")) {
    printWarning("Atlassian is installed via `mcp-remote`; Codex may show `Auth: Unsupported`, which is expected for this wrapper.");
  }
  if (selected.includes("slack")) {
    printWarning("Slack is installed for Claude only; Codex does not currently support Slack's required fixed-client MCP OAuth flow.");
  }
}

function removeClaudeMcps(selected: string[], baseDir: string) {
  const mcpFile = getClaudeMcpFile(baseDir);
  const config = readJsonFile(mcpFile) ?? {};
  const configRecord = config as Record<string, unknown>;
  const servers = configRecord.mcpServers && typeof configRecord.mcpServers === "object"
    ? configRecord.mcpServers as Record<string, unknown>
    : {};

  for (const key of selected) {
    delete servers[key];
  }

  configRecord.mcpServers = servers;
  writeJsonFile(mcpFile, configRecord);
  return mcpFile;
}

function removeCodexMcps(selected: string[], baseDir: string) {
  const configPath = getCodexConfigFile(baseDir);
  const config = readTomlFile(configPath) ?? {};
  const configRecord = config as Record<string, unknown>;
  const servers = configRecord.mcp_servers && typeof configRecord.mcp_servers === "object"
    ? configRecord.mcp_servers as Record<string, unknown>
    : {};

  for (const key of selected) {
    delete servers[key];
  }

  configRecord.mcp_servers = servers;
  writeTomlFile(configPath, configRecord);
  return configPath;
}

function removeMcps(selected: string[], baseDir: string) {
  const claudePath = removeClaudeMcps(selected, baseDir);
  const codexPath = removeCodexMcps(selected, baseDir);
  printSuccess(`Removed ${selected.length} ${pluralize(selected.length, "MCP", "MCPs")} from ${claudePath} and ${codexPath}`);
}

function getResourceChoices(location: "global" | "cwd" = "global"): Choice<string>[] {
  const commandChoices = getCommandChoices().map((choice) => ({
    value: "command:" + choice.value,
    label: choice.label,
    description: choice.description,
  }));
  const hookChoices = getHookChoices().map((choice) => ({
    value: "hook:" + choice.value,
    label: choice.label,
    description: choice.description,
  }));
  const mcpChoices = getMcpChoices().map((choice) => ({
    value: "mcp:" + choice.value,
    label: choice.label,
    description: choice.description,
  }));
  const skillChoices = getSkillChoices().map((choice) => ({
    value: "skill:" + choice.value,
    label: choice.label,
    description: choice.description,
  }));
  const choices: Choice<string>[] = [
    { value: "header:commands", label: "Slash Commands (Claude only)", selectable: false },
    ...commandChoices,
    { value: "header:hooks", label: "Hooks", selectable: false },
    ...hookChoices,
    { value: "header:mcps", label: "MCP Servers", selectable: false },
    ...mcpChoices,
    { value: "header:skills", label: "Skills", selectable: false },
    ...skillChoices,
  ];
  if (location === "cwd") {
    choices.push(
      { value: "header:permissions", label: "Permissions (cwd only)", selectable: false },
      { value: "permission:base", label: "Base permissions", description: "Write base allow/deny rules to .claude/settings.json" },
    );
  }
  return choices;
}

function normalizeHookCommand(command: string, hookDir: string) {
  const normalizedDir = hookDir.replace(/\\/g, "/");
  return command
    .replace(/"\$CLAUDE_PROJECT_DIR"\/\.claude\/hooks\//g, normalizedDir + "/")
    .replace(/\$CLAUDE_PROJECT_DIR\/\.claude\/hooks\//g, normalizedDir + "/");
}

function normalizeHookDefinition(definition: Record<string, unknown>, hookDir: string) {
  const clone = JSON.parse(JSON.stringify(definition)) as Record<string, unknown>;

  for (const rules of Object.values(clone)) {
    if (!Array.isArray(rules)) {
      continue;
    }
    for (const rule of rules) {
      if (!rule || typeof rule !== "object") {
        continue;
      }
      const hooks = Array.isArray((rule as { hooks?: unknown[] }).hooks)
        ? (rule as { hooks: unknown[] }).hooks
        : [];
      for (const hook of hooks) {
        if (!hook || typeof hook !== "object") {
          continue;
        }
        const record = hook as Record<string, unknown>;
        if (typeof record.command === "string") {
          record.command = normalizeHookCommand(record.command, hookDir);
        }
      }
    }
  }

  return clone;
}

function collectHookCommands(definition: Record<string, unknown>) {
  const commands: string[] = [];
  for (const rules of Object.values(definition)) {
    if (!Array.isArray(rules)) {
      continue;
    }
    for (const rule of rules) {
      if (!rule || typeof rule !== "object") {
        continue;
      }
      const hooks = Array.isArray((rule as { hooks?: unknown[] }).hooks)
        ? (rule as { hooks: unknown[] }).hooks
        : [];
      for (const hook of hooks) {
        if (!hook || typeof hook !== "object") {
          continue;
        }
        const record = hook as Record<string, unknown>;
        if (typeof record.command === "string") {
          commands.push(record.command);
        }
      }
    }
  }
  return unique(commands);
}

function mergeUniqueObjects(existing: unknown[], incoming: unknown[]) {
  const seen = new Set(existing.map((value) => JSON.stringify(value)));
  const merged = [...existing];
  for (const value of incoming) {
    const key = JSON.stringify(value);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(value);
    }
  }
  return merged;
}

function lstatSafe(path: string) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function ensureSymlink(sourcePath: string, targetPath: string) {
  ensureDir(dirname(targetPath));
  if (existsSync(targetPath) || lstatSafe(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }
  symlinkSync(sourcePath, targetPath);
}

function installPermissions(baseDir: string) {
  const sourcePath = join(RESOURCE_PERMISSIONS_ROOT, "base-permissions.json");
  const claudeDir = join(baseDir, ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  const source = readJsonFile(sourcePath) as Record<string, unknown> | null;
  if (!source) {
    printWarning("Could not read base-permissions.json");
    return;
  }

  ensureDir(claudeDir);
  const existing = (readJsonFile(settingsPath) ?? {}) as Record<string, unknown>;

  // Merge top-level allow/deny arrays (dedup)
  for (const key of ["allow", "deny"] as const) {
    const src = Array.isArray(source[key]) ? source[key] as string[] : [];
    const dst = Array.isArray(existing[key]) ? existing[key] as string[] : [];
    existing[key] = [...new Set([...dst, ...src])];
  }

  // Merge env object (source keys win if missing in existing)
  if (source.env && typeof source.env === "object") {
    existing.env = { ...(source.env as Record<string, unknown>), ...(existing.env as Record<string, unknown> ?? {}) };
  }

  // Only set sandbox if not already present
  if (!("sandbox" in existing) && "sandbox" in source) {
    existing.sandbox = source.sandbox;
  }

  writeJsonFile(settingsPath, existing);
  printSuccess(`Wrote permissions to ${settingsPath}`);
}

function installCommands(selected: string[], baseDir: string) {
  const targetRoot = join(baseDir, ".claude", "commands");
  ensureDir(targetRoot);

  for (const relativePath of selected) {
    const sourcePath = join(RESOURCE_COMMANDS_ROOT, relativePath);
    const targetPath = join(targetRoot, relativePath);
    ensureSymlink(sourcePath, targetPath);
  }

  printSuccess(`Symlinked ${selected.length} ${pluralize(selected.length, "command", "commands")} into ${targetRoot}`);
}

function installHooks(selected: string[], baseDir: string) {
  const catalog = getHookCatalog();
  const claudeDir = join(baseDir, ".claude");
  const hooksDir = join(claudeDir, "hooks");
  const settingsPath = join(claudeDir, "settings.json");
  const settings = readJsonFile(settingsPath) ?? {};
  const settingsRecord = settings as Record<string, unknown>;
  const hooksRecord = settingsRecord.hooks && typeof settingsRecord.hooks === "object"
    ? settingsRecord.hooks as Record<string, unknown>
    : {};
  settingsRecord.hooks = hooksRecord;

  const permissions = settingsRecord.permissions && typeof settingsRecord.permissions === "object"
    ? settingsRecord.permissions as Record<string, unknown>
    : {};
  settingsRecord.permissions = permissions;
  const allow = Array.isArray(permissions.allow) ? permissions.allow as string[] : [];
  permissions.allow = allow;

  ensureDir(hooksDir);

  for (const key of selected) {
    ensureSymlink(join(RESOURCE_HOOK_FILES_ROOT, key), join(hooksDir, key));
  }

  for (const key of selected) {
    const entry = catalog[key];
    if (!entry || !entry.hooks || typeof entry.hooks !== "object") {
      continue;
    }

    const normalizedHooks = normalizeHookDefinition(entry.hooks as Record<string, unknown>, hooksDir);
    for (const [eventName, rules] of Object.entries(normalizedHooks)) {
      if (!Array.isArray(rules)) {
        continue;
      }
      const existingRules = Array.isArray(hooksRecord[eventName]) ? hooksRecord[eventName] as unknown[] : [];
      hooksRecord[eventName] = mergeUniqueObjects(existingRules, rules);
    }

    for (const command of collectHookCommands(normalizedHooks)) {
      const permission = "Bash(" + command + ")";
      if (!allow.includes(permission)) {
        allow.push(permission);
      }
    }
  }

  writeJsonFile(settingsPath, settingsRecord);
  printSuccess(`Installed ${selected.length} ${pluralize(selected.length, "hook set", "hook sets")} into ${claudeDir} with symlinked hook files`);
}

function installSkills(selected: SkillCatalogEntry[], target: "codex" | "claude" | "both", baseDir: string) {
  const duplicateSkillNames = selected
    .map((entry) => entry.skill)
    .filter((skill, index, all) => all.indexOf(skill) !== index);
  if (duplicateSkillNames.length > 0) {
    throw new CliError(
      "Selected the same skill from multiple sources: " + unique(duplicateSkillNames).join(", ") + ". Choose one source per skill.",
    );
  }

  const roots = target === "both"
    ? [join(baseDir, ".codex", "skills"), join(baseDir, ".claude", "skills")]
    : [join(baseDir, target === "codex" ? ".codex" : ".claude", "skills")];

  for (const root of roots) {
    ensureDir(root);
    for (const skill of selected) {
      const targetPath = join(root, skill.skill);
      ensureSymlink(skill.sourcePath, targetPath);
    }
  }

  const targetLabel = target === "both" ? "Codex and Claude" : target === "codex" ? "Codex" : "Claude";
  printSuccess(`Symlinked ${selected.length} ${pluralize(selected.length, "skill", "skills")} into ${targetLabel} skills at ${baseDir}`);
}

async function runAddWizard() {
  printBanner();
  console.log("");
  printSection("Add Wizard");

  const location = await selectOne("Where do you want to install?", [
    { value: "global", label: "Global", description: "Install into your home directory (~/.claude, ~/.codex)" },
    { value: "cwd", label: "Current directory", description: "Install into " + process.cwd() + " (.claude, .codex)" },
  ]);

  const baseDir = location === "global" ? HOME : process.cwd();

  const selected = await selectMany(
    "Select the resources you want to add:",
    getResourceChoices(location),
  );

  if (selected.length === 0) {
    printWarning("No resources selected.");
    return;
  }

  const commands = selected.filter((value) => value.startsWith("command:")).map((value) => value.slice("command:".length));
  const hooks = selected.filter((value) => value.startsWith("hook:")).map((value) => value.slice("hook:".length));
  const mcps = selected.filter((value) => value.startsWith("mcp:")).map((value) => value.slice("mcp:".length));
  const skillKeys = selected.filter((value) => value.startsWith("skill:")).map((value) => value.slice("skill:".length));
  const permissions = selected.filter((value) => value.startsWith("permission:"));
  const skillCatalog = getSkillCatalog();
  const skills = skillKeys.flatMap((key) => {
    const match = skillCatalog.find((entry) => entry.key === key);
    return match ? [match] : [];
  });

  if (commands.length > 0) installCommands(commands, baseDir);
  if (hooks.length > 0) installHooks(hooks, baseDir);
  if (mcps.length > 0) await installMcps(mcps, baseDir);
  if (permissions.length > 0) installPermissions(baseDir);

  if (skills.length > 0) {
    const target = await selectOne("Install selected skills for which agent?", [
      { value: "codex", label: "Codex", description: "Install into .codex/skills" },
      { value: "claude", label: "Claude", description: "Install into .claude/skills" },
      { value: "both", label: "Both", description: "Install into both skill directories" },
    ]);
    installSkills(skills, target, baseDir);
  }

  printSuccess("Wizard complete.");
}

function getInstalledHooks(baseDir: string): InstalledHook[] {
  const settingsPath = join(baseDir, ".claude", "settings.json");
  const settings = readJsonFile(settingsPath) ?? {};
  const hooksRecord = settings.hooks && typeof settings.hooks === "object"
    ? settings.hooks as Record<string, unknown>
    : {};
  const hooksDir = join(baseDir, ".claude", "hooks");

  // Build a reverse map from normalized rule JSON → catalog folder key
  const ruleToFolderKey = new Map<string, string>();
  for (const [key, entry] of Object.entries(getHookCatalog())) {
    if (!entry.hooks || typeof entry.hooks !== "object") continue;
    const normalized = normalizeHookDefinition(entry.hooks as Record<string, unknown>, hooksDir);
    for (const rules of Object.values(normalized)) {
      if (!Array.isArray(rules)) continue;
      for (const rule of rules) ruleToFolderKey.set(JSON.stringify(rule), key);
    }
  }

  const result: InstalledHook[] = [];
  for (const [eventName, rules] of Object.entries(hooksRecord)) {
    if (!Array.isArray(rules)) continue;
    for (const rule of rules) {
      if (!rule || typeof rule !== "object") continue;
      const hookList = Array.isArray((rule as { hooks?: unknown[] }).hooks)
        ? (rule as { hooks: unknown[] }).hooks
        : [];
      const desc = hookList.flatMap((hook) => {
        if (!hook || typeof hook !== "object") return [];
        const h = hook as Record<string, unknown>;
        return typeof h.command === "string" ? [h.command] : typeof h.type === "string" ? [h.type] : [];
      }).join(", ") || "(unknown)";
      const folderKey = ruleToFolderKey.get(JSON.stringify(rule));
      result.push({ eventName, label: eventName + " -> " + desc, rule, folderKey });
    }
  }
  return result;
}

function removeCommands(selected: string[], baseDir: string) {
  const commandsDir = join(baseDir, ".claude", "commands");
  for (const relativePath of selected) {
    rmSync(join(commandsDir, relativePath), { force: true });
  }
  printSuccess(`Removed ${selected.length} ${pluralize(selected.length, "command", "commands")} from ${commandsDir}`);
}

function removeHookItems(items: InstalledHook[], baseDir: string) {
  const claudeDir = join(baseDir, ".claude");
  const settingsPath = join(claudeDir, "settings.json");
  const settings = readJsonFile(settingsPath) ?? {};
  const settingsRecord = settings as Record<string, unknown>;
  const hooksRecord = settingsRecord.hooks && typeof settingsRecord.hooks === "object"
    ? { ...(settingsRecord.hooks as Record<string, unknown>) }
    : {};

  for (const item of items) {
    const existing = Array.isArray(hooksRecord[item.eventName]) ? hooksRecord[item.eventName] as unknown[] : [];
    const removeKey = JSON.stringify(item.rule);
    const filtered = existing.filter((v) => JSON.stringify(v) !== removeKey);
    if (filtered.length === 0) {
      delete hooksRecord[item.eventName];
    } else {
      hooksRecord[item.eventName] = filtered;
    }
  }

  if (Object.keys(hooksRecord).length === 0) {
    delete settingsRecord.hooks;
  } else {
    settingsRecord.hooks = hooksRecord;
  }

  writeJsonFile(settingsPath, settingsRecord);

  // Remove symlinked hook folders for catalog-managed hooks (deduplicated)
  const hooksDir = join(claudeDir, "hooks");
  const foldersToRemove = new Set(items.map((i) => i.folderKey).filter(Boolean) as string[]);
  for (const key of foldersToRemove) {
    rmSync(join(hooksDir, key), { recursive: true, force: true });
  }

  printSuccess(`Removed ${items.length} ${pluralize(items.length, "hook", "hooks")} from ${claudeDir}`);
}

function removeSkills(selected: string[], baseDir: string) {
  const roots = [join(baseDir, ".claude", "skills"), join(baseDir, ".codex", "skills")];
  for (const root of roots) {
    for (const skill of selected) {
      rmSync(join(root, skill), { recursive: true, force: true });
    }
  }
  printSuccess(`Removed ${selected.length} ${pluralize(selected.length, "skill", "skills")} from ${baseDir}`);
}

async function runRemoveWizard() {
  printBanner();
  console.log("");
  printSection("Remove Wizard");

  const location = await selectOne("Where do you want to remove from?", [
    { value: "global", label: "Global", description: "Remove from your home directory (~/.claude, ~/.codex)" },
    { value: "cwd", label: "Current directory", description: "Remove from " + process.cwd() + " (.claude, .codex)" },
  ]);

  const baseDir = location === "global" ? HOME : process.cwd();

  const commandsDir = join(baseDir, ".claude", "commands");
  const installedCommands = listFiles(commandsDir, (path) => [".md", ".txt"].includes(extname(path)))
    .map((path) => pathLabel(commandsDir, path));

  const installedSkills = getInstalledSkillKeys(baseDir);

  const installedHooks = getInstalledHooks(baseDir);
  const installedMcps = getInstalledMcpKeys(baseDir);

  const choices: Choice<string>[] = [
    ...(installedCommands.length > 0
      ? [
          { value: "header:commands", label: "Slash Commands (Claude only)", selectable: false } as Choice<string>,
          ...installedCommands.map((path) => ({
            value: "command:" + path,
            label: commandLabel(join(commandsDir, path), commandsDir),
            description: path,
          })),
        ]
      : []),
    ...(installedHooks.length > 0
      ? [
          { value: "header:hooks", label: "Hooks", selectable: false } as Choice<string>,
          ...installedHooks.map((hook, i) => ({
            value: "hook:" + i,
            label: hook.label,
          })),
        ]
      : []),
    ...(installedMcps.length > 0
      ? [
          { value: "header:mcps", label: "MCP Servers", selectable: false } as Choice<string>,
          ...installedMcps.map((key) => ({
            value: "mcp:" + key,
            label: key,
          })),
        ]
      : []),
    ...(installedSkills.length > 0
      ? [
          { value: "header:skills", label: "Skills", selectable: false } as Choice<string>,
          ...installedSkills.map((skill) => ({
            value: "skill:" + skill,
            label: skill,
          })),
        ]
      : []),
  ];

  if (choices.length === 0) {
    printWarning("No resources found at the selected location.");
    return;
  }

  const selected = await selectMany("Select resources to remove:", choices);

  if (selected.length === 0) {
    printWarning("No resources selected.");
    return;
  }

  const commands = selected.filter((v) => v.startsWith("command:")).map((v) => v.slice("command:".length));
  const hookIndices = selected.filter((v) => v.startsWith("hook:")).map((v) => parseInt(v.slice("hook:".length)));
  const mcps = selected.filter((v) => v.startsWith("mcp:")).map((v) => v.slice("mcp:".length));
  const skills = selected.filter((v) => v.startsWith("skill:")).map((v) => v.slice("skill:".length));

  if (commands.length > 0) removeCommands(commands, baseDir);
  if (hookIndices.length > 0) removeHookItems(hookIndices.map((i) => installedHooks[i]!), baseDir);
  if (mcps.length > 0) removeMcps(mcps, baseDir);
  if (skills.length > 0) removeSkills(skills, baseDir);

  printSuccess("Remove complete.");
}

function printHelp() {
  printBanner();
  console.log("");
  console.log("Usage: eve <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  " + colorize("setup", colors.bold) + "      Install deps and link eve globally");
  console.log("  " + colorize("doctor", colors.bold) + "     Show version, bin resolution, and repo diagnostics");
  console.log("  " + colorize("tools", colors.bold) + "      List AI tools from global and cwd config");
  console.log("  " + colorize("add", colors.bold) + "        Wizard to install commands, hooks, and skills from resources");
  console.log("  " + colorize("remove", colors.bold) + "     Wizard to remove installed commands, hooks, and skills");
  console.log("  " + colorize("help", colors.bold) + "       Show this help");
  console.log("");
  console.log("Examples:");
  console.log("  eve tools");
  console.log("  eve tools codex");
  console.log("  eve tools claude");
  console.log("  eve add");
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
  const packageJsonPresent = existsSync(resolve(REPO_ROOT, "package.json"));
  const bunLockPresent = existsSync(resolve(REPO_ROOT, "bun.lock"));
  const nodeModulesPresent = existsSync(resolve(REPO_ROOT, "node_modules"));
  const bunVersion = runCommand(["bun", "--version"], { allowFailure: true, quiet: true });
  const bunPath = runCommand(["which", "bun"], { allowFailure: true, quiet: true });
  const nodePath = runCommand(["which", "node"], { allowFailure: true, quiet: true });
  const linkedEve = runCommand(["which", "eve"], { allowFailure: true, quiet: true });
  const allLinkedEve = runCommand(["which", "-a", "eve"], { allowFailure: true, quiet: true });
  const shellPath = process.env.SHELL ?? "unknown";
  const pathEntries = (process.env.PATH ?? "").split(":").filter(Boolean);
  const packageJson = readJsonFile(resolve(REPO_ROOT, "package.json")) as { name?: string; version?: string; bin?: Record<string, string> } | undefined;
  const expectedEntrypoint = resolve(REPO_ROOT, packageJson?.bin?.eve ?? "src/cli.ts");

  const eveOnPath = linkedEve.exitCode === 0;
  const bunOnPath = bunPath.exitCode === 0;
  const eveResolvesFromBunBin = eveOnPath && linkedEve.stdout.includes("/.bun/bin/");
  const allLines = allLinkedEve.stdout.split("\n").filter(Boolean);
  const eveResolutionIncludesActive = eveOnPath && allLines.some((line) => line.trim() === linkedEve.stdout.trim());

  const environmentRows: DoctorRow[] = [
    { label: "repo", value: REPO_ROOT, note: "Source checkout used for this eve install." },
    { label: "package", value: packageJson?.name ?? "unknown", note: "Package name read from package.json." },
    { label: "version", value: packageJson?.version ?? VERSION, note: "CLI version reported by this checkout." },
    { label: "shell", value: shellPath, note: "Current shell environment." },
    { label: "bun", value: bunVersion.exitCode === 0 ? bunVersion.stdout.trim() : colorize("not found", colors.red), note: "Bun version available to this process." },
    { label: "bun path", value: bunPath.exitCode === 0 ? bunPath.stdout.trim() : colorize("not found", colors.red), note: "Resolved Bun executable used for install and link operations." },
    { label: "node path", value: nodePath.exitCode === 0 ? nodePath.stdout.trim() : colorize("not found", colors.red), note: "Resolved Node executable on PATH." },
    { label: "cwd", value: process.cwd(), note: "Directory where you ran `eve doctor`." },
    { label: "entrypoint", value: expectedEntrypoint, note: "CLI script configured as the eve executable target." },
    { label: "linked eve", value: linkedEve.exitCode === 0 ? linkedEve.stdout.trim() : colorize("not found", colors.red), note: "Executable your shell will run when you type `eve`." },
    { label: "PATH entries", value: String(pathEntries.length), note: "Number of directories currently searched for commands." },
  ];

  const resolutionRows: DoctorRow[] = allLinkedEve.stdout
    ? allLinkedEve.stdout.split("\n").filter(Boolean).map((line, index) => ({
        label: index === 0 ? "active lookup" : `fallback ${index}`,
        value: line.trim() === linkedEve.stdout.trim() ? colorize(line, colors.green) : line,
      }))
    : [{ label: "active lookup", value: colorize("eve not found in PATH", colors.red) }];

  const configurationRows: DoctorRow[] = [
    { label: "package.json present", value: doctorStatus(packageJsonPresent) },
    { label: "bun.lock present", value: doctorStatus(bunLockPresent) },
    { label: "node_modules present", value: doctorStatus(nodeModulesPresent) },
    { label: "eve on PATH", value: doctorStatus(eveOnPath) },
    { label: "bun on PATH", value: doctorStatus(bunOnPath) },
    { label: "eve resolves from bun bin", value: doctorStatus(eveResolvesFromBunBin) },
    { label: "active eve appears in resolution list", value: doctorStatus(eveResolutionIncludesActive) },
  ];

  console.log(colorize("eve doctor", colors.bold, colors.cyan));
  console.log("");
  printDoctorSection("Environment Snapshot", environmentRows);
  printDoctorSection("eve Resolution", resolutionRows);
  printDoctorSection("Expected Configuration", configurationRows);

  if (!eveOnPath) {
    console.log("suggestion:");
    console.log("  Run `eve setup` from this repository to install dependencies and register the command.");
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
      case "add":
        await runAddWizard();
        return 0;
      case "remove":
        await runRemoveWizard();
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
