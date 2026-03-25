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
```

## Commands

```bash
eve setup    # Run bun install + bun link from this repo
eve doctor   # Inspect version, bin resolution, PATH, and repo config
```

## Uninstall

```bash
bun pm unlink eve
```
