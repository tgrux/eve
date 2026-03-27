---
name: ralph-loop-docs
description: >
  Generate the complete documentation scaffold for a Ralph Loop — an autonomous AI coding framework
  that runs continuous, self-iterating bash-driven loops using Claude Code until all milestones are
  complete. Produces: ai-specs/ folder containing ralph.md (workflow entry point), pin.md (static
  system context), specs/ with individual milestone specs, and completed/ with checklist; plus
  ralph.sh (bash driver script), Dockerfile, and ralph-how-to.md in ai-ralph/ at the project root.
  Use this skill whenever someone mentions "Ralph Loop", "ralph.md", "autonomous coding loop",
  "milestone documentation for an agent", "agentic coding scaffold", or wants to set up documentation
  that an AI agent will use to self-direct through a series of milestones. Also trigger when someone
  has a project idea and wants to break it into milestones for autonomous execution, or wants to
  create a structured spec system for iterative AI-driven development.
---
 
# Ralph Loop Documentation Scaffold
 
This skill produces a complete documentation system designed to drive a Ralph Loop — an autonomous AI coding agent that reads a set of docs, works on the next open milestone, commits, and repeats until everything is done.
 
The output is a set of files that an agent can consume without ambiguity. Every design choice below exists to reduce wasted agent context, prevent duplicated instructions, and make the "what do I work on next?" decision trivial.
 
## Output Structure
 
```
project-root/
├── ai-ralph/
│   ├── ralph.sh              # Bash script that drives the loop (run from project root)
│   ├── Dockerfile            # (Dockerized only) Builds the ralph-sandbox Docker image
│   └── ralph-how-to.md       # (Dockerized only) Colima setup and run instructions
└── ai-specs/
    ├── ralph.md          # Entry point: overview, milestone table (status tracking), workflow instructions
    ├── pin.md            # Static system context: domain facts that don't change as milestones progress
    ├── specs/
    │   ├── m1.md         # One spec per milestone
    │   ├── m2.md
    │   └── ...
    └── completed/
        ├── MILESTONE-COMPLETION-CHECKLIST.md   # Checkbox log referencing completion summaries
        ├── m1-complete.md                      # Written by the agent after finishing M1
        └── ...
```
 
## Process Overview
 
There are two phases: **Discovery** (interview the user to understand their project and define milestones) and **Scaffolding** (produce all the files). Do not start writing files until Discovery is complete and the user has confirmed the milestone list.
 
---
 
## Phase 1: Discovery
 
The goal is to extract everything the agent will need to self-direct through the project. You're interviewing the user to fill three mental buckets:
 
1. **Project identity** — What is this thing? What does it do? What systems does it touch?
2. **Domain constraints** — What are the fixed rules of the environment? (APIs, access levels, ticket types, label conventions, architecture patterns, runtime/tooling)
3. **Milestones** — What are the discrete chunks of work, in what order, and what does "done" look like for each?
 
### 1A: Project Identity
 
Start here. Ask the user to describe the project in a few sentences. You're looking for:
 
- What the software does (one paragraph)
- Who or what uses it (users, other systems, cron jobs)
- What external systems it integrates with (JIRA, Slack, Confluence, databases, APIs)
 
If the user has existing documentation (a README, a requirements doc, prior conversation context), ask them to share it. Extract what you can and confirm gaps with the user rather than re-asking questions they've already answered.
 
### 1B: Domain Constraints
 
These are the static facts about the project's environment — things that won't change as milestones are completed. They become pin.md. Ask about:
 
- **External system configuration**: project keys, ticket types, label taxonomies, space names, access levels (read-only? read-write?)
- **Architecture principles**: programming paradigms, module organization conventions, shared utility patterns, testing philosophies
- **Interaction patterns**: How do users trigger features? What format should output take? Are features also callable programmatically?
 
Don't ask about runtime or tooling (language, package manager, test runner) — the agent can discover these from package.json, Cargo.toml, or equivalent. pin.md should contain only things the agent *cannot* infer from the codebase itself.
 
### 1C: Milestone Definition
 
This is the heart of Discovery. You're helping the user decompose their project into milestones that an autonomous agent can execute sequentially.
 
**What makes a good milestone:**
 
- **Self-contained**: An agent can implement it, write tests, and commit without needing to touch the next milestone.
- **Testable**: There are concrete acceptance criteria the agent can verify.
- **Right-sized**: Big enough to be meaningful, small enough that an agent can finish it in one iteration (roughly 1-3 hours of agent time). If a milestone feels like it would take a week of human work, it's too big — split it.
- **Sequential**: Each milestone can depend on prior milestones being complete, but should not require knowledge of future milestones. The agent works top-to-bottom.
 
**Interview technique:**
 
Start broad: "What are the major features or capabilities you need to build?" Let the user brain-dump. Then help them refine:
 
- Are any of these features actually multiple milestones? (Look for "and" — "build the API and the dashboard" is two milestones.)
- Are any of these features actually infrastructure that other features depend on? (Pull those out as earlier milestones.)
- Is the ordering right? Would the agent need Feature B's code to implement Feature C?
- Are there supplemental milestones needed? (Bug fixes, formatting changes, testing framework setup that arose after an initial milestone.) If so, slot them into the sequence and renumber — every milestone gets a simple sequential number (M1, M2, M3...).
 
For each milestone, extract:
 
- **Title**: Short, descriptive name
- **Objective**: One paragraph explaining what this milestone achieves and why
- **Requirements**: Specific behaviors grouped by sub-feature (use `###` headings within requirements when there are distinct categories)
- **Acceptance criteria**: How the agent knows it's done — concrete, testable statements
- **Technical notes** (optional): Implementation hints, API quirks, or gotchas that would save the agent time
 
**Important questions to ask during milestone definition:**
 
- "Are there any milestones that are purely infrastructure (no user-facing output) vs. feature milestones?"
- "For audit/report milestones: what categories should findings be grouped by? What data should each finding include?"
- "Are there cross-system concerns that should be consolidated into their own milestone rather than scattered across multiple milestones?" (This prevents the situation where a "JIRA-only" audit accidentally requires Confluence data.)
- "For each milestone, is every check actually achievable using only the systems mentioned in the objective?" (If a milestone says "JIRA-only" but a requirement needs Confluence, move that requirement.)
 
### 1D: Execution Environment
 
Ask how the user wants to run the Ralph Loop:
 
- **Dockerized (autonomous)**: The agent runs inside a Docker container via ralph.sh. This is the isolated, walk-away approach. Produces a Dockerfile and ralph-how-to.md alongside ralph.sh in `ai-ralph/`.
- **Local (supervised)**: The agent runs directly on the user's machine via ralph.sh. Same `ai-ralph/` folder with ralph.sh, but no Dockerfile or ralph-how-to.md.
 
Both modes use ralph.sh to drive the loop — the difference is whether the script invokes `claude` directly or via `docker run`.
 
Also ask:
 
- "Do you have any linting or auto-fix tools that run during development (e.g., stop hooks, pre-commit hooks, ESLint with --fix)?" If yes, add the relevant step to the "Working on a Milestone" workflow and include it in the Run Metadata section. If no, omit it.
 
### 1E: Confirm Before Proceeding
 
Before writing any files, present the user with:
 
1. A summary of the project identity (what becomes the Overview in ralph.md)
2. A bullet list of domain constraints (what becomes pin.md)
3. The ordered milestone table with titles and one-line descriptions
4. The execution environment choice (Docker or local)
 
Ask: "Does this look right? Any milestones to add, remove, reorder, or split?"
 
Only proceed to Phase 2 after the user confirms.
 
---
 
## Phase 2: Scaffolding
 
Now produce the files. The order matters — create foundational files first so you can cross-reference them.
 
### 2A: Create ai-specs/pin.md
 
This is the static system context file. It contains domain facts that don't change as milestones are completed.
 
**Template:**
 
```markdown
# pin.md — System Context
This file describes the domain constraints [PROJECT NAME] operates within. These are static facts — they do not change as milestones are completed. For runtime and tooling details, see `package.json`.
 
## [System 1] Configuration
- [Key facts: project keys, ticket types, access levels, etc.]
 
## [System 2] Configuration
- [Key facts: space names, label taxonomies, etc.]
 
## Architecture Principles
- [Programming paradigm, module organization, testing patterns]
 
## [Interaction Model] Conventions
- [How users trigger features, output format, programmatic callability]
```
 
**Rules for pin.md:**
 
- Only include facts the agent cannot discover from the codebase (no runtime versions, no dependency lists)
- Don't repeat information that belongs in individual specs
- If a constraint applies to all milestones (e.g., "all features must be callable programmatically"), it goes here — not in every spec
- Keep it scannable: bullet points, not prose
 
### 2B: Create ai-specs/specs/ folder and individual spec files
 
One file per milestone. The spec template is deliberately minimal — specs should contain only what's specific to that milestone.
 
**Template:**
 
```markdown
# [M#]: [Title]
## Objective
[One paragraph: what this milestone achieves and why it matters. If it excludes certain concerns, say so explicitly (e.g., "cross-system checks live in M7").]
 
## Requirements
### [Sub-feature 1]
- [Specific behavior]
- [Specific behavior]
 
### [Sub-feature 2]
- [Specific behavior]
 
## Acceptance Criteria
- [Concrete, testable statement]
- [Concrete, testable statement]
- [Unit tests verify X against mock data, including edge cases (list examples)]
 
## Technical Notes
- [Optional: implementation hints, API quirks, gotchas]
```
 
**Rules for specs:**
 
- No dependency lists — milestones are sequential, so the agent always has access to everything from prior milestones
- No global constraints — those live in pin.md (don't repeat valid statuses, access levels, architecture principles)
- No cross-references to other milestone numbers unless absolutely necessary for clarity — prefer "later milestones" or "earlier milestones" to specific numbers, since milestone numbering may change
- Specs for already-completed milestones should reflect the *original requirements*, not what was delivered (the completion summary captures delivery details)
- If a milestone references a utility built in a prior milestone, say "uses the [utility name]" without specifying which milestone built it
 
### 2C: Create ai-specs/ralph.md
 
This is the entry point the agent reads on every iteration. It needs to answer: "What do I work on?" and "How do I work on it?" — nothing more.
 
**Template:**
 
```markdown
# [Project Name] — Ralph Loop Documentation
 
## Overview
[2-3 sentences: what the project is, what it does, and that this file drives a Ralph Loop.]
 
For environment constraints ([list key topics]), see `pin.md`.
 
## Milestones
Milestones are executed sequentially in the order listed below. Complete each milestone before starting the next.
 
| # | Milestone | Status | Spec |
|---|-----------|--------|------|
| M1 | [Title] | [Open/Complete] | `specs/m1.md` |
| M2 | [Title] | [Open/Complete] | `specs/m2.md` |
| ... | ... | ... | ... |
 
For completion summaries and detailed progress, see `completed/MILESTONE-COMPLETION-CHECKLIST.md`.
 
## How to Work on Milestones
 
### Selecting a Milestone
1. Find the first milestone in the table above with status `Open`.
2. Before starting fresh, check if related code changes already exist in the codebase from a previous interrupted iteration. Look for new files, modified modules, and existing tests related to this milestone.
3. If prior work exists: read the spec, run existing tests to assess current state, and pick up where the previous iteration left off. Do not start over or rewrite working code.
4. If no prior work exists: proceed to "Working on a Milestone."
 
### Working on a Milestone
1. Read the milestone spec (e.g., `specs/m1.md`).
2. Implement the feature according to the spec.
3. Write unit tests — ensure edge cases are handled.
4. [If the user has a linting/auto-fix tool, add a step here. If not, omit this step entirely.]
5. Write integration tests — focus on critical paths only.
6. Run all tests until 100% pass.
7. Commit your changes.
 
### Completing a Milestone
Completion is bookkeeping only — do not count it as milestone work.
 
1. Update the milestone's status from `Open` to `Complete` in the table above.
2. Create a new file in the `completed/` folder named `<milestone>-complete.md` (e.g., `completed/m1-complete.md`).
3. Populate this file with a summary of the changes you made for the milestone.
4. At the bottom of the file, add a `## Run Metadata` section.
   - If the user has a linting/auto-fix tool, include: **[Tool name] fixes:** list of auto-fixes applied (or "None" if clean).
   - Cost and execution time are appended automatically by ralph.sh after the iteration ends — the agent should not try to fill these in.
5. Open `completed/MILESTONE-COMPLETION-CHECKLIST.md` and check the box for the milestone you completed, referencing the summary file.
6. Commit, then finish your iteration.
7. If all milestones are complete, output `RALPH_COMPLETE`.
```
 
**Rules for ralph.md:**
 
- The milestone table is the sole source of truth for "what to work on next" — the agent should not need to open any other file to make this decision
- Don't duplicate pin.md content — point to it with a one-line reference
- Don't enumerate every completed milestone's summary — point to the checklist
- The "How to Work on Milestones" section must include resume guidance (step 2-3 in Selecting) because agent iterations can be interrupted mid-milestone
- The completion signal (`RALPH_COMPLETE`) must be a unique string unlikely to appear in normal conversation, so the bash script can detect it reliably
 
### 2D: Create ai-specs/completed/ folder and checklist
 
**MILESTONE-COMPLETION-CHECKLIST.md template:**
 
```markdown
# Milestone Completion Checklist
 
- [ ] **M1: [Title]**
- [ ] **M2: [Title]**
- [ ] ...
```
 
If milestones are already complete, check those boxes and add ` — see m#-complete.md` references. For completed milestones, also create the corresponding completion summary files.
 
**Completion summary template (for milestones already done):**
 
```markdown
# [M#] Completion Summary: [Title]
 
## What Was Delivered
[Describe what was actually built, organized by sub-feature]
```
 
Note: only pre-populate completion summaries for milestones the user confirms are already done. For open milestones, the agent creates these files as it completes work.
 
### 2E: Create ai-ralph/ralph.sh
 
The bash script lives in ai-ralph/ but is designed to be run from the project root (e.g., `./ai-ralph/ralph.sh 10`). This ensures `$(pwd)` resolves to the project root for correct file paths and Docker volume mounts. It passes ai-specs/ralph.md and ai-specs/pin.md as context and stops when it detects the completion signal.
 
The script parses stream-json output from Claude Code, displaying both agent output and any stop-hook output (e.g., linting tools like Zenable). Stop hooks inject their output as `user` type events in the stream — the `seen_assistant` flag distinguishes these from the initial prompt submission.
 
**Local execution:** Copy `.claude/skills/ralph-loop-docs/references/ralph.sh` to `ai-ralph/ralph.sh` and make it executable (`chmod +x ai-ralph/ralph.sh`). This script is ready to use as-is for local execution.

**Dockerized execution adaptation:** To run inside Docker instead, add `IMAGE="ralph-sandbox"` near the top of the script, add an image existence check after the API key validation:

```bash
if ! docker image inspect "$IMAGE" &>/dev/null; then
  echo "Error: Docker image '$IMAGE' not found. Build it first: docker build -t $IMAGE ai-ralph/"
  exit 1
fi
```

Then replace the `claude \` command block with:

```bash
  docker run --rm \
    -v "$(pwd):/workspace" \
    -w /workspace \
    -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    -v "$HOME/.gitconfig:/root/.gitconfig:ro" \
    "$IMAGE" \
    --output-format stream-json --verbose --permission-mode acceptEdits -p "@ai-specs/ralph.md @ai-specs/pin.md \
    Follow the instructions in ai-specs/ralph.md. ONLY WORK ON A SINGLE MILESTONE. \
If all milestones are complete, output RALPH_COMPLETE." 2>"$stderr_dest" | \
```

Note: Stop hooks configured on the host machine will **not** fire inside the Docker container — only hooks installed within the container image will run.
 
### 2F–2G: Docker-only files (skip for local execution)
 
#### 2F: Create ai-ralph/Dockerfile

Copy `.claude/skills/ralph-loop-docs/references/Dockerfile` to `ai-ralph/Dockerfile`. Build the image from the project root (one-time, or after updating the Dockerfile):

```bash
docker build -t ralph-sandbox ai-ralph/
```

The image name `ralph-sandbox` must match the `IMAGE` variable in ralph.sh.

#### 2G: Create ai-ralph/ralph-how-to.md

Copy `.claude/skills/ralph-loop-docs/references/ralph-how-to.md` to `ai-ralph/ralph-how-to.md`. This covers Colima setup, API key configuration, permissions, and how to run the loop.
 
---
 
## Design Principles
 
These principles emerged from real iteration on Ralph Loop documentation. They exist because violating them caused agent confusion, wasted context, or duplicated work.
 
### Static vs. Dynamic Separation
pin.md holds facts that never change (system config, architecture rules). ralph.md holds state that evolves (milestone status, workflow instructions). Mixing them means the agent re-reads unchanging facts every time it checks status, and risks accidentally modifying constraints when updating progress.
 
### DRY Across Files
Every piece of information should live in exactly one file. If valid JIRA statuses are listed in pin.md, individual specs should not repeat them. If the workflow for completing a milestone is in ralph.md, the checklist should not re-explain it. When the agent sees the same instruction in two places, it wastes context and risks acting on stale versions.
 
### Agent Context Efficiency
The agent loads ai-specs/ralph.md and ai-specs/pin.md at the start of every iteration. Everything in those files costs tokens. The milestone table in ralph.md tells the agent what to work on without opening any other file. The spec files are only opened when the agent starts working on a specific milestone. Completion summaries are only written, never read by the agent during normal work. This layered loading keeps per-iteration context cost low.
 
### Specs Reflect Requirements, Not Delivery
A completed milestone's spec still describes what was *asked for*. What was actually *delivered* goes in the completion summary. This separation means the spec remains useful as a reference for understanding intent, even if the implementation diverged.
 
### Sequential Execution
Milestones are ordered and executed top-to-bottom. This eliminates the need for dependency graphs, parallel execution logic, or "which milestones can I work on?" decision trees. The agent's decision is always: "find the first Open milestone, do it."
 
### Unique Completion Signal
The bash script detects completion by grepping for `RALPH_COMPLETE` in the agent's output. This string is deliberately unusual — a word like "COMPLETE" alone could appear in normal conversation and trigger a false positive.
 
### Resume Over Restart
Agent iterations can be interrupted (timeout, crash, context exhaustion). The workflow explicitly tells the agent to check for prior work before starting fresh. This prevents the agent from re-implementing code that already exists and passes tests.
