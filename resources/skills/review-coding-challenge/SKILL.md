---
name: review-coding-challenge
description: Evaluate a coding challenge submission against the standard Kin rubric. Use when reviewing interview submissions — reads all source files, tests, and documentation directly before scoring. Do not rely on summaries or assumptions.
---

# Coding Challenge Review Skill

Evaluate a candidate's coding challenge submission against the standard rubric. **Read every relevant source file directly before scoring anything.** Do not assume, summarize from filenames, or delegate to a subagent and trust its summary — verify claims yourself.

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

### Code Completion
> Evaluated vs. the expected completion level for the role they are applying to.

| Rating | Criteria |
|--------|----------|
| Red X | The code does not compile. The solution does not solve the main problem. There's a significant lack of efficiency. |
| Thumbs Down | Compiles without errors. Solves the problem. Efficiency could be improved. |
| Thumbs Up | Compiles without errors. Solves the problem. Reasonably efficient with some areas for improvement. Fails gracefully with some error handling, but does not cover most cases. |
| Star | Compiles without errors. Optimized for efficiency. Contains most error cases. |

**What to look for:**
- Does it actually run? (check for syntax errors, missing imports, broken dependencies)
- Does it solve all parts of the stated problem?
- Are there dead/stub methods left in? (e.g., `console.log` placeholders wired to real events)
- Does error handling cover the real failure modes, or just the happy path?
- Are there display/rendering bugs caused by type coercion (e.g., `parseInt` stripping leading zeros)?
- Is the submit/action button accessible for large datasets or awkward placements?

---

### Tests

| Rating | Criteria |
|--------|----------|
| Red X | No tests or only generated boilerplate. Minimal or no real coverage. |
| Thumbs Down | Few tests, covering only the most obvious cases. Flows could be simplified. |
| Thumbs Up | Good number of tests covering various scenarios. Flows are mostly straightforward. |
| Star | Comprehensive tests covering all possible edge cases. Flows are simple and easy to understand. |

**What to look for:**
- Count actual tests — distinguish real assertions from smoke tests (`expect(component).toBeTruthy()`)
- Do the tests prove the thing the code claims? (e.g., "handles any length" — are there non-9-digit test cases?)
- Are HTTP calls tested with proper mocking and verification (`afterEach verify()`)?
- Are edge cases covered: empty input, invalid types, boundary values, error states?
- Are there gaps between what the template renders and what the tests assert?

---

### Communication

| Rating | Criteria |
|--------|----------|
| Red X | No documentation, minimal or wrong information. Does not describe how to run the system. No environment setup info. Code is not readable. |
| Thumbs Down | Basic documentation. Attempted to communicate process and intent. Describes how to run the system but lacks clarity. Some setup info but may be incomplete. Code is somewhat readable. |
| Thumbs Up | Comprehensive documentation with few areas of improvement. Clear and concise communication. Clearly describes how to run the system. Setup and test instructions are mostly clear. Code is mostly easy to follow. |
| Star | Exceptional documentation. Clearly communicates the solution and demonstrates tangential knowledge (pros/cons of approaches). Detailed run instructions. Precise setup steps, assumptions, and future improvements documented. Code is exceptionally readable. |

**What to look for:**
- Does the README describe what the app does, not just how to run it?
- Are assumptions documented? (e.g., "CSV is comma-delimited with no headers")
- Are algorithmic decisions explained? (e.g., why checksum works on any length)
- Are future improvements or known limitations called out?
- Is inline code documentation present where logic isn't self-evident?

---

### Code Sophistication

| Rating | Criteria |
|--------|----------|
| Red X | Code is difficult to understand. Cluttered and messy. Does not follow language conventions or best practices. |
| Thumbs Down | Some parts are clean, others are not. Follows some conventions but not consistently. |
| Thumbs Up | Generally clean (e.g., follows SOLID principles) with minor areas for improvement. Follows language conventions consistently. Good encapsulation. |
| Star | Clean and well-structured. Follows language conventions consistently. Follows a pattern that fits the problem well (or explains how it would expand to fit). |

**What to look for:**
- Is logic separated into appropriate layers? (services/utils vs. components)
- Are there memory leaks? (unsubscribed observables, missing cleanup)
- Are tracking expressions in loops correct? (e.g., `track item` vs `track item.id`)
- Does the component/module structure reflect the problem, or is everything crammed into one place?
- Are there dead code artifacts or placeholder methods in the final submission?
- Is TypeScript used correctly? (strict mode, interfaces, no implicit `any`)

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
```
