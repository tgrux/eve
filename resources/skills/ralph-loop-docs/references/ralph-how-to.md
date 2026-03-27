# How to Run the Ralph Loop

This project uses Colima instead of Docker Desktop. The ralph.sh script runs Claude Code inside a Docker container for autonomous, isolated execution.

## Prerequisites

Colima is running. Verify:
```bash
colima status
docker context use colima
docker info
```

Build the Docker image (one-time, from project root):
```bash
docker build -t ralph-sandbox ai-ralph/
```

Set your API key — the container uses `ANTHROPIC_API_KEY` as an env var (no stored credentials like Docker Desktop sandbox):
```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
source ~/.zshrc
```

Make the script executable (one-time):
```bash
chmod +x ai-ralph/ralph.sh
```

## Running

Always run from the project root so the Docker volume mount captures the full codebase:
```bash
./ai-ralph/ralph.sh 10
```

The script runs up to the specified number of iterations. Each iteration works on a single milestone. The loop stops early if all milestones are complete.

## How it works

Claude runs isolated inside a container, edits files on your host via a volume mount, and commits using your git identity. The key differences from Docker Desktop sandbox:

| Docker Desktop sandbox | Colima equivalent |
|---|---|
| `docker sandbox run claude` | `docker run --rm -v ... ralph-sandbox` |
| Auto-mounts current directory | `-v "$(pwd):/workspace"` |
| Auto-injects `~/.gitconfig` | `-v "$HOME/.gitconfig:/root/.gitconfig:ro"` |
| Uses stored Claude credentials | `-e ANTHROPIC_API_KEY=...` |
| Proprietary sandbox image | Your own `Dockerfile` |

Keep this file focused on setup and running. Don't duplicate information that lives in ralph.md or pin.md.
