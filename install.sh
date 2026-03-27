#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing eve..."

# Check for bun
if ! command -v bun &>/dev/null; then
  echo "Error: bun is required. Install it at https://bun.sh"
  exit 1
fi

cd "$SCRIPT_DIR"

# Install dependencies
bun install

# Link globally — creates a symlink so source changes are picked up immediately
bun link

echo "Done. Run 'eve --version' to verify."
