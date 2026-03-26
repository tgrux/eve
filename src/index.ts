import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
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
const RESOURCE_HOOK_SETTINGS_PATH = join(RESOURCES_ROOT, "settings", "hooks.json");
const RESOURCE_SKILLS_ROOT = join(RESOURCES_ROOT, "skills");
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

function writeJsonFile(path: string, value: unknown) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
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

function getCommandChoices(): Choice<string>[] {
  return listFiles(RESOURCE_COMMANDS_ROOT, (path) => extname(path) === ".md").map((path) => ({
    value: pathLabel(RESOURCE_COMMANDS_ROOT, path),
    label: commandLabel(path, RESOURCE_COMMANDS_ROOT),
    description: pathLabel(RESOURCE_COMMANDS_ROOT, path),
  }));
}

function getSkillChoices(): Choice<string>[] {
  return extractSkills(RESOURCE_SKILLS_ROOT).map((skill) => ({
    value: skill,
    label: skill,
  }));
}

function getHookCatalog() {
  const raw = readJsonFile(RESOURCE_HOOK_SETTINGS_PATH) ?? {};
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => !key.startsWith("_")),
  ) as Record<string, HookCatalogEntry>;
}

function getHookChoices(): Choice<string>[] {
  const catalog = getHookCatalog();
  return Object.entries(catalog).map(([key, value]) => ({
    value: key,
    label: value.name ?? key,
    description: value.description,
  }));
}

function getResourceChoices(): Choice<string>[] {
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
  const skillChoices = getSkillChoices().map((choice) => ({
    value: "skill:" + choice.value,
    label: choice.label,
    description: "resources/skills/" + choice.value,
  }));
  return [
    { value: "header:commands", label: "Commands", selectable: false },
    ...commandChoices,
    { value: "header:hooks", label: "Hooks", selectable: false },
    ...hookChoices,
    { value: "header:skills", label: "Skills", selectable: false },
    ...skillChoices,
  ];
}

function normalizeHookCommand(command: string) {
  const hookDir = join(HOME, ".claude", "hooks").replace(/\\/g, "/");
  return command
    .replace(/"\$CLAUDE_PROJECT_DIR"\/\.claude\/hooks\//g, hookDir + "/")
    .replace(/\$CLAUDE_PROJECT_DIR\/\.claude\/hooks\//g, hookDir + "/");
}

function normalizeHookDefinition(definition: Record<string, unknown>) {
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
          record.command = normalizeHookCommand(record.command);
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

function installCommands(selected: string[]) {
  const targetRoot = join(HOME, ".claude", "commands");
  ensureDir(targetRoot);

  for (const relativePath of selected) {
    const sourcePath = join(RESOURCE_COMMANDS_ROOT, relativePath);
    const targetPath = join(targetRoot, relativePath);
    ensureSymlink(sourcePath, targetPath);
  }

  printSuccess("Symlinked " + selected.length + " command" + (selected.length === 1 ? "" : "s") + " into ~/.claude/commands");
}

function installHooks(selected: string[]) {
  const catalog = getHookCatalog();
  const settingsPath = join(HOME, ".claude", "settings.json");
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

  ensureDir(join(HOME, ".claude", "hooks"));
  for (const hookFile of listFiles(RESOURCE_HOOK_FILES_ROOT, () => true)) {
    const targetPath = join(HOME, ".claude", "hooks", pathLabel(RESOURCE_HOOK_FILES_ROOT, hookFile));
    ensureSymlink(hookFile, targetPath);
  }

  for (const key of selected) {
    const entry = catalog[key];
    if (!entry || !entry.hooks || typeof entry.hooks !== "object") {
      continue;
    }

    const normalizedHooks = normalizeHookDefinition(entry.hooks as Record<string, unknown>);
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
  printSuccess("Installed " + selected.length + " hook set" + (selected.length === 1 ? "" : "s") + " into ~/.claude with symlinked hook files");
}

function installSkills(selected: string[], target: "codex" | "claude" | "both") {
  const roots = target === "both"
    ? [join(HOME, ".codex", "skills"), join(HOME, ".claude", "skills")]
    : [join(HOME, target === "codex" ? ".codex" : ".claude", "skills")];

  for (const root of roots) {
    ensureDir(root);
    for (const skill of selected) {
      const sourcePath = join(RESOURCE_SKILLS_ROOT, skill);
      const targetPath = join(root, skill);
      ensureSymlink(sourcePath, targetPath);
    }
  }

  const targetLabel = target === "both" ? "Codex and Claude" : target === "codex" ? "Codex" : "Claude";
  printSuccess("Symlinked " + selected.length + " skill" + (selected.length === 1 ? "" : "s") + " into global " + targetLabel + " skills");
}

async function runAddWizard() {
  printBanner();
  console.log("");
  printSection("Add Wizard");

  const selected = await selectMany(
    "Select the resources you want to add globally:",
    getResourceChoices(),
  );

  if (selected.length === 0) {
    printWarning("No resources selected.");
    return;
  }

  const commands = selected.filter((value) => value.startsWith("command:")).map((value) => value.slice("command:".length));
  const hooks = selected.filter((value) => value.startsWith("hook:")).map((value) => value.slice("hook:".length));
  const skills = selected.filter((value) => value.startsWith("skill:")).map((value) => value.slice("skill:".length));

  if (commands.length > 0) {
    installCommands(commands);
  }

  if (hooks.length > 0) {
    installHooks(hooks);
  }

  if (skills.length > 0) {
    const target = await selectOne("Install selected skills for which agent?", [
      { value: "codex", label: "Codex", description: "Install into ~/.codex/skills" },
      { value: "claude", label: "Claude", description: "Install into ~/.claude/skills" },
      { value: "both", label: "Both", description: "Install into both global skill directories" },
    ]);
    installSkills(skills, target);
  }

  printSuccess("Wizard complete.");
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
  console.log("  " + colorize("add", colors.bold) + "        Wizard to install global commands, hooks, and skills from resources");
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
      case "add":
        await runAddWizard();
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
