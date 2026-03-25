#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY is not set"
  exit 1
fi

IMAGE="ralph-sandbox"
total_cost=0

for ((i=1; i<=$1; i++)); do
  echo ""
  echo "=== Iteration $i / $1 ==="

  events_file=$(mktemp)

  docker run --rm \
    -v "$(pwd):/workspace" \
    -w /workspace \
    -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    -v "$HOME/.gitconfig:/root/.gitconfig:ro" \
    "$IMAGE" \
    --output-format stream-json --verbose --permission-mode acceptEdits -p "@spec/requirements.md @progress.txt \
1. Find the highest-priority incomplete feature and implement it. \
2. Run your tests and type checks. \
3. Update spec/requirements.md to mark the task as done. \
4. Append your progress to progress.txt. \
5. Commit your changes. \
ONLY WORK ON A SINGLE TASK. \
If all tasks are complete, output <promise>COMPLETE</promise>." 2>/dev/null | \
  while IFS= read -r line; do
    echo "$line" >> "$events_file"
    type=$(echo "$line" | jq -r '.type' 2>/dev/null)
    case "$type" in
      assistant)
        echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text' 2>/dev/null
        ;;
    esac
  done

  cost=$(tail -1 "$events_file" | jq -r '.total_cost_usd' 2>/dev/null || echo "0")
  result_text=$(tail -1 "$events_file" | jq -r '.result' 2>/dev/null || echo "")
  total_cost=$(echo "$total_cost + $cost" | bc)

  echo ""
  echo "--- Cost: \$$cost | Running total: \$$total_cost ---"

  rm "$events_file"

  if echo "$result_text" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "All tasks complete after $i iterations."
    exit 0
  fi
done

echo ""
echo "Reached $1 iterations. Total cost: \$$total_cost"
