# Colima Setup for Ralph Loop

This project uses Colima instead of Docker Desktop. [The tutorial's](https://www.aihero.dev/getting-started-with-ralph) `docker sandbox run claude`
is a Docker Desktop-only feature — this guide replaces it with standard `docker run`.

---

## Prerequisites

Colima is running. Verify:

```bash
colima status
docker context use colima
docker info
```

Set your API key - the container uses `ANTHROPIC_API_KEY` as an env var (no stored credentials like Docker Desktop sandbox):

```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
source ~/.zshrc
```

Make sure scripts are executable:

```bash
chmod +x ralph.sh
chmod +x ralph-once.sh
```

---

## What each script does

| Script | Runs where | Use when |
|---|---|---|
| `ralph-once.sh` | Locally (your machine) | You're watching — supervised, one task |
| `ralph.sh` | Inside Docker container | You're stepping away — autonomous loop |

`ralph-once.sh` runs `claude` directly on your machine and is already correct — no Docker needed.

---

## Supervised Run

```bash
./ralph-once.sh
```

**Autonomous (you walk away, N iterations):**

```bash
./ralph.sh 10
```

---

## Key differences from the tutorial

| Docker Desktop sandbox | Colima equivalent |
|---|---|
| `docker sandbox run claude` | `docker run --rm -v ... ralph-sandbox` |
| Auto-mounts current directory | `-v "$(pwd):/workspace"` |
| Auto-injects `~/.gitconfig` | `-v "$HOME/.gitconfig:/root/.gitconfig:ro"` |
| Uses stored Claude credentials | `-e ANTHROPIC_API_KEY=...` |
| Proprietary sandbox image | Your own `Dockerfile` |

The behavior is identical — Claude runs isolated inside a container, edits files on your host
via the volume mount, and commits using your git identity.
