---
name: ralph-loop-compress
description: >
  Compress completed Ralph Loop milestones into a phase summary archive. Consolidates
  individual completion summaries and spec files into a single reference document, keeping
  the active workspace lean and making AI-assisted review cheaper. Use when a Ralph Loop
  project has accumulated many completed milestones, a phase is done, or the user wants
  to archive finished work before starting a new batch.
  Trigger when someone says "compress ralph milestones", "archive completed specs",
  "create a phase summary", "clean up the completed folder", or "too many spec files".
---

# Ralph Loop — Spec Compression

This skill compresses completed Ralph Loop milestones into a phase archive. It consolidates many small `m#-complete.md` files and their corresponding specs into a single `PHASE-SUMMARY.md`, keeping the active workspace focused on open work.

**Why this matters:** Individual completion summaries are useful while work is fresh. Over time they create noise — many files that must be loaded or enumerated to get a picture of the project. A phase summary collapses them into one scannable document, which is also far cheaper to feed to an AI for review or handoff.

---

## Before You Start

Confirm two things with the user:

1. **Which milestones to archive** — typically all `Complete` milestones, but the user may want to leave recent ones in place. Ask: "Should I archive all completed milestones, or only milestones up to a specific one?"
2. **Phase number** — if this is the first compression run, it's Phase 1. Ask if they've compressed before so the archive file is named correctly (e.g., `PHASE-2-SUMMARY.md`).

---

## Compression Workflow

### Step 1: Read all completion summaries for milestones being archived

Open each `ai-specs/completed/m#-complete.md` for the milestones in scope. Read all of them before writing anything.

### Step 2: Create `ai-specs/archive/PHASE-[N]-SUMMARY.md`

Create `ai-specs/archive/` if it doesn't exist. Write a single consolidated document:

```markdown
# Phase [N] Summary

## Milestones Archived
- M1: [Title]
- M2: [Title]
- ...

## What Was Built

### M1: [Title]
[Key outcomes, implementation decisions, any spec deviations]

### M2: [Title]
[Key outcomes, implementation decisions, any spec deviations]

...

## Cross-Cutting Notes
[Any patterns, decisions, or constraints that emerged across multiple milestones and are worth remembering for future phases]
```

**Rules for the summary:**
- Synthesize, don't just concatenate. If multiple milestones share a pattern or decision, say it once in Cross-Cutting Notes rather than repeating it per milestone.
- Preserve deviations from the original spec — these are the most valuable things to record.
- Keep each milestone section to 3–5 bullet points. The goal is a fast-scan reference, not a transcript.

### Step 3: Move spec files to archive

For each milestone being archived, move `ai-specs/specs/m#.md` to `ai-specs/archive/specs/m#.md`.

### Step 4: Delete completion summaries

Delete each `ai-specs/completed/m#-complete.md` for the milestones being archived. Their content has been captured in the PHASE-[N]-SUMMARY.md.

### Step 5: Update the milestone table in ralph.md

For each archived milestone, update its `Spec` column link from `specs/m#.md` to `archive/specs/m#.md`.

### Step 6: Commit

```
chore: compress phase [N] milestones into archive
```

---

## Result

After compression:

```
ai-specs/
├── ralph.md                   # Milestone table updated — archived rows link to archive/specs/
├── pin.md                     # Unchanged
├── specs/                     # Contains only open milestones
│   └── m#.md (open only)
├── completed/
│   ├── MILESTONE-COMPLETION-CHECKLIST.md   # Unchanged
│   └── m#-complete.md (open only — archived ones deleted)
└── archive/
    ├── PHASE-[N]-SUMMARY.md   # Full history for archived milestones
    └── specs/
        └── m#.md (archived specs)
```

The active `specs/` and `completed/` folders contain only open work. The archive has the full history in one place.

---

## Design Notes

**Compression is lossy by design.** Individual summaries collapse into a single doc. That's the point — the detail that mattered during implementation is preserved at a summary level, without every file needing to be loaded for context.

**Timing is the user's call.** Don't compress automatically. The user decides when a phase is done and worth archiving.

**Don't compress open milestones.** Only archive milestones with status `Complete` in the ralph.md milestone table.

**The original specs are preserved in archive/specs/, not deleted.** This keeps the original requirements accessible if needed, just out of the active workspace.
