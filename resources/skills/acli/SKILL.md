---
name: acli
description: Use the Atlassian CLI (acli) to interact with Jira and Confluence from the terminal. Use when the user asks to create, view, edit, search, or transition Jira work items, manage sprints/boards/projects, or work with Confluence pages.
---

# Atlassian CLI (acli)

`acli` is installed and authenticated. Use it to interact with Jira and Confluence directly from the terminal.

## Command Structure

```
acli <product> <entity> <action> [flags]
```

Products: `jira`, `confluence`, `admin`

## Jira — Work Items

**View a work item:**
```bash
acli jira workitem view KEY-123
acli jira workitem view KEY-123 --fields summary,status,assignee,description
acli jira workitem view KEY-123 --json
acli jira workitem view KEY-123 --web
```

**Search (JQL):**
```bash
acli jira workitem search --jql "project = SW AND status = 'In Progress' AND assignee = currentUser()"
acli jira workitem search --jql "project = SW" --fields "key,summary,status,assignee" --csv
acli jira workitem search --jql "project = SW" --limit 20 --json
acli jira workitem search --jql "project = SW" --paginate   # fetch all results
acli jira workitem search --jql "project = SW" --count      # just the count
```

**Create:**
```bash
acli jira workitem create --summary "Fix login bug" --project "SW" --type "Bug"
acli jira workitem create --summary "New feature" --project "SW" --type "Story" --assignee "@me"
acli jira workitem create --summary "Sub-task" --project "SW" --type "Task" --parent "SW-123"
acli jira workitem create --summary "..." --project "SW" --type "Task" --description "Details here" --label "backend,urgent"
```

**Edit:**
```bash
acli jira workitem edit --key "SW-123" --summary "Updated summary"
acli jira workitem edit --key "SW-123" --assignee "@me"
acli jira workitem edit --key "SW-123,SW-124" --label "reviewed"
acli jira workitem edit --jql "project = SW AND status = 'To Do'" --assignee "user@example.com" --yes
```

**Transition (change status):**
```bash
acli jira workitem transition --key "SW-123" --status "In Progress"
acli jira workitem transition --key "SW-123" --status "Done"
acli jira workitem transition --jql "project = SW AND assignee = currentUser()" --status "In Review" --yes
```

**Other workitem actions:**
```bash
acli jira workitem assign --key "SW-123" --assignee "@me"
acli jira workitem comment create --key "SW-123" --comment "Looking into this now"
acli jira workitem clone --key "SW-123"
acli jira workitem delete --key "SW-123"
```

## Jira — Sprints & Boards

```bash
acli jira board search                          # find boards
acli jira board list-sprints --board-id 42      # list sprints on a board
acli jira sprint view --sprint-id 99
acli jira sprint list-workitems --sprint-id 99
acli jira sprint list-workitems --sprint-id 99 --jql "assignee = currentUser()"
```

## Jira — Projects

```bash
acli jira project list
acli jira project view --project "SW"
```

## Confluence

```bash
acli confluence page view --id 12345
acli confluence space list
```

## Output Flags

| Flag | Effect |
|------|--------|
| `--json` | Machine-readable JSON output |
| `--csv` | CSV output (search only) |
| `--web` | Open in browser |
| `--fields` | Comma-separated fields to include |
| `--limit N` | Cap results at N |
| `--paginate` | Fetch all pages of results |
| `-y / --yes` | Skip confirmation prompts |

## JQL Quick Reference

```
project = SW                                    # by project
assignee = currentUser()                        # my items
status = "In Progress"                          # by status
status in ("To Do", "In Progress")              # multiple statuses
sprint in openSprints()                         # active sprint
updated >= -7d                                  # recently updated
labels = "backend"                              # by label
type = Bug                                      # by issue type
order by updated DESC                           # sort
```

## Tips

- Use `--json` when you need to parse output or chain commands
- Use `--yes` / `-y` on bulk operations to skip per-item confirmations
- Use `--jql` with `acli jira workitem edit` or `transition` to bulk-update many issues at once
- `@me` is a shorthand for the authenticated user's email in `--assignee`
- If you don't know a project key, run `acli jira project list` first
