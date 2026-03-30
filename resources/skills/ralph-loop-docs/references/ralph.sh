#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations> [--verbose]"
  exit 1
fi

if [ "$2" = "--verbose" ]; then
  stderr_dest=/dev/stderr
else
  stderr_dest=/dev/null
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY is not set"
  exit 1
fi
if [[ ! "$ANTHROPIC_API_KEY" =~ ^sk-ant-[A-Za-z0-9_-]{20,}$ ]]; then
  echo "Error: ANTHROPIC_API_KEY does not look like a valid Anthropic key (expected sk-ant- followed by 20+ alphanumeric characters)"
  exit 1
fi

events_file=$(mktemp)
trap 'echo ""; echo "Interrupted."; rm -f "$events_file"; kill 0; exit 1' INT TERM

if command -v eve &>/dev/null; then
  eve tools
  echo ""
fi

total_cost=0

for ((i=1; i<=$1; i++)); do
  echo ""
  echo "=== Iteration $i / $1 ==="

  : > "$events_file"
  start_time=$(date +%s)

  echo "Starting Claude... (this may take a moment)"

  seen_assistant=0
  claude \
    --output-format stream-json --verbose --permission-mode acceptEdits -p "@ai-specs/ralph.md @ai-specs/pin.md \
    Follow the instructions in ai-specs/ralph.md. ONLY WORK ON A SINGLE MILESTONE. \
If all milestones are complete, output RALPH_COMPLETE." 2>"$stderr_dest" | \
  while IFS= read -r line; do
    echo "$line" >> "$events_file"
    type=$(echo "$line" | jq -r '.type' 2>/dev/null)
    case "$type" in
      assistant)
        seen_assistant=1
        echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text' 2>/dev/null
        echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | "[tool] \(.name)"' 2>/dev/null
        ;;
      user)
        if [ "$seen_assistant" -eq 1 ]; then
          echo "$line" | jq -r '.message.content[]? | select(.type == "text") | "[zenable] \(.text)"' 2>/dev/null
        fi
        ;;
    esac
  done
  claude_exit=${PIPESTATUS[0]}
  if [ "$claude_exit" -ne 0 ]; then
    echo "Error: claude exited with code $claude_exit" >&2
    rm -f "$events_file"
    exit "$claude_exit"
  fi

  last_event=$(tail -1 "$events_file")
  if event_parsed=$(echo "$last_event" | jq -r '(.total_cost_usd // "0"), (.result // "")' 2>/dev/null); then
    cost=$(printf '%s\n' "$event_parsed" | head -1)
    result_text=$(printf '%s\n' "$event_parsed" | tail -n +2)
  else
    echo "Warning: could not parse final event from events file" >&2
    cost="0"
    result_text=""
  fi
  total_cost=$(echo "$total_cost + $cost" | bc)
  end_time=$(date +%s)
  elapsed=$(( end_time - start_time ))
  minutes=$(( elapsed / 60 ))
  seconds=$(( elapsed % 60 ))

  echo ""
  echo "--- Cost: \$$cost | Running total: \$$total_cost | Duration: ${minutes}m ${seconds}s ---"

  # Update the most recently modified completion file with actual run metadata
  latest_complete=$(ls -t ai-specs/completed/*-complete.md 2>/dev/null | head -1)
  if [ -n "$latest_complete" ]; then
    zenable_count=$(grep -c 'Zenable AI Review' "$events_file" 2>/dev/null || echo "0")
    if grep -q '## Run Metadata' "$latest_complete" 2>/dev/null; then
      # Replace Claude's placeholder estimates with actual values
      sed -i '' "s/\*\*Cost:\*\* .*/**Cost:** \$$cost/" "$latest_complete"
      sed -i '' "s/\*\*Execution time:\*\* .*/**Execution time:** ${minutes}m ${seconds}s/" "$latest_complete"
      sed -i '' "s/\*\*Zenable fixes:\*\* .*/**Zenable fixes:** $zenable_count/" "$latest_complete"
    else
      printf '\n## Run Metadata\n- **Cost:** $%s\n- **Execution time:** %dm %ds\n- **Zenable fixes:** %s\n' \
        "$cost" "$minutes" "$seconds" "$zenable_count" >> "$latest_complete"
    fi
    complete_name=$(basename "$latest_complete")
    git_out=$(git add "$latest_complete" 2>&1) || {
      echo "Warning: git add failed for $complete_name: $git_out" >&2
    }
    git_out=$(git commit -m "Add run metadata to $complete_name" --no-verify 2>&1) || {
      echo "Warning: git commit failed for $complete_name: $git_out" >&2
    }
  fi

  if echo "$result_text" | grep -q "RALPH_COMPLETE"; then
    echo ""
    echo "All milestones complete after $i iterations."
    rm -f "$events_file"
    exit 0
  fi
done

rm -f "$events_file"

echo ""
echo "Reached $1 iterations. Total cost: \$$total_cost"
