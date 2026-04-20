---
name: review-coding-challenge
description: Evaluate a coding challenge submission against the standard Kin rubric. Use when reviewing interview submissions — reads all source files, tests, and documentation directly before scoring. Do not rely on summaries or assumptions.
---

# Coding Challenge Review Skill

Evaluate a candidate's coding challenge submission against the standard rubric. **Read every relevant source file directly before scoring anything.** Do not assume, summarize from filenames, or delegate to a subagent and trust its summary — verify claims yourself.

## Step 0: What Test Type?

Make sure you understand what test type it is, the Frontend Test or Backend Test. Once you know which one it is, read the instructions the candidate received:
- FE Test: `/Users/tim.giegel/Code/_tools/eve/resources/skills/review-coding-challenge/references/fe-test.md`
- BE Test: `/Users/tim.giegel/Code/_tools/eve/resources/skills/review-coding-challenge/references/be-test.md`

## Step 1: Read the submission

Before scoring, read:
- README and any documentation files
- All source/logic files (services, components, models, utilities)
- All test files — count the tests, read what they actually assert
- package.json or equivalent for dependencies and scripts
- Any config files relevant to build/test setup

Flag any claims in the code or README you cannot verify from the source (e.g., "handles any length" — check if tests prove it).

## Step 2: Score each category

Use the rubric below. For each category, cite specific file and line number evidence for your rating. Do not give a rating you cannot point to in the code.

---

## Rubric

Read the full rubric at `/Users/tim.giegel/Code/_tools/eve/resources/skills/review-coding-challenge/references/rubric.md` before scoring — it defines what Red X, Thumbs Down, Thumbs Up, and Star mean for each category, plus the minimum passing threshold (Thumbs Up in all four categories).

### Code Completion

**What to look for:**
- Does it actually run? (check for syntax errors, missing imports, broken dependencies)
- Does it solve all parts of the stated problem?
- Are there dead/stub methods left in? (e.g., `console.log` placeholders wired to real events)
- Does error handling cover the real failure modes, or just the happy path?
- Are there display/rendering bugs caused by type coercion (e.g., `parseInt` stripping leading zeros)?

---

### Tests

**What to look for:**
- Count actual tests — distinguish real assertions from smoke tests (`expect(component).toBeTruthy()`)
- Do the tests prove the thing the code claims? (e.g., "handles any length" — are there non-9-digit test cases?)
- Are HTTP calls tested with proper mocking and verification (`afterEach verify()`)?
- Are edge cases covered: empty input, invalid types, boundary values, error states?
- Are there gaps between what the template renders and what the tests assert?

---

### Communication

**What to look for:**
- Does the README describe what the app does, not just how to run it? Grade on the quality and intent of explanation, not README length. A short README that explains why outscores a long one that only describes what.
- Are assumptions documented? (e.g., "CSV is comma-delimited with no headers")
- Are algorithmic decisions explained? (e.g., why checksum works on any length)
- Are future improvements or known limitations called out?
- Is inline code documentation present where logic isn't self-evident?
- Code comments count toward the Communication score, not just the README. A well-placed comment explaining a trade-off or design decision ("this is overkill but..."  ) is meaningful communication.


---

### Code Sophistication

**What to look for:**
- Is logic separated into appropriate layers? (services/utils vs. components)
- Are there memory leaks? (unsubscribed observables, missing cleanup)
- Are tracking expressions in loops correct? (e.g., `track item` vs `track item.id`)
- Does the component/module structure reflect the problem, or is everything crammed into one place?
- Are there dead code artifacts or placeholder methods in the final submission?
- Is TypeScript used correctly? (strict mode, interfaces, no implicit `any`)
- Are the framework's reactive primitives (signals, observables, etc.) used consistently for all state, or does the component mix paradigms partway through? Check that reactive imports are actually used.
  - Do async operations clean up after themselves? Look for subscriptions, promises, or event listeners that aren't torn down when the component is destroyed.
  - Do async functions actually await something? An async keyword with no await is a sign of paradigm confusion.
  - Do services expose state in a way that maintains encapsulation, or can callers mutate internal state directly? Do service methods take data as parameters, or silently depend on internal state?

---

## Step 3: Output format

Present the evaluation as:

```
## Coding Challenge Review

### Code Completion: [Red X | Thumbs Down | Thumbs Up | Star]
[2-4 sentences. Lead with what works, then what specifically holds it back. Cite file:line where relevant.]

### Tests: [Red X | Thumbs Down | Thumbs Up | Star]
[2-4 sentences. State the actual test count broken down by file. Call out what's covered well and what gaps exist.]

### Communication: [Red X | Thumbs Down | Thumbs Up | Star]
[2-4 sentences. Be specific about what the README does and doesn't cover.]

### Code Sophistication: [Red X | Thumbs Down | Thumbs Up | Star]
[2-4 sentences. Call out specific structural decisions — good and bad.]

---

| Category | Rating |
|---|---|
| Code Completion | [rating] |
| Tests | [rating] |
| Communication | [rating] |
| Code Sophistication | [rating] |

**Overall take:** [1-2 sentence summary for the hiring team.]

**Hire recommendation:** [Pass / No Pass] — [one sentence explaining the deciding factor. Note any category below Thumbs Up that blocks advancement.]
```
