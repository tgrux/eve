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
```

## Commands

```bash
eve setup         # Run bun install + bun link from this repo
eve doctor        # Inspect version, bin resolution, PATH, and repo config
eve tools         # List global and cwd AI agent tools for Claude and Codex
eve tools codex   # List Codex MCPs, hooks, and skills
eve tools claude  # List Claude MCPs, hooks, skills, and slash commands
```

## Uninstall

```bash
bun unlink eve
```
