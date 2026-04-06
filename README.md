# eve

Protective armor CLI for local tooling, guardrails, and repo setup.

## Installation

```bash
bun install
bun link
```

After linking, the `eve` command will be available globally.

## Quick Start

```bash
eve
eve --help
eve --version
eve setup
eve doctor
eve tools
eve tools codex
eve tools claude
eve add
```

## Commands

```bash
eve setup         # Run bun install + bun link from this repo
eve doctor        # Inspect version, bin resolution, PATH, and repo config
eve tools         # List global and cwd AI agent tools for Claude and Codex
eve tools codex   # List Codex MCPs, hooks, and skills
eve tools claude  # List Claude MCPs, hooks, skills, and slash commands
eve add           # Wizard to install global commands, hooks, and skills from resources/
```

## Add Wizard

`eve add` installs from this repo's `resources/` directory using a single interactive arrow-key picker. Commands, hooks, and skills are shown together in one grouped list, and selected items are symlinked so changes in this repo propagate automatically.

- `Commands` symlink markdown files from `resources/commands/` into `~/.claude/commands/`
- `Hooks` symlink hook files from `resources/hooks/` into `~/.claude/hooks/` and merge selected hook definitions into `~/.claude/settings.json`
- `Skills` symlink selected skill directories from `resources/skills/` plus any configured extra skill roots into `~/.codex/skills/`, `~/.claude/skills/`, or both
- Wizard controls: `↑/↓` move, `space` toggles items, `enter` confirms, `q` cancels

## Extra Skill Roots

`eve add` always includes built-in skills from `resources/skills/`. You can add more skill source directories by creating either `~/.config/eve/config.json` or `./.eve/config.json` with a `skillRoots` array.

```json
{
  "skillRoots": [
    "/Users/tim/Code/_tools/baymax/skills"
  ]
}
```

Relative paths are resolved from the directory containing the config file. Global and repo-local `skillRoots` are merged together.

## Uninstall

```bash
bun unlink eve
```
