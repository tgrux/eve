Diff the changes on the current branch against main and perform a thorough code review:

## Stage 0 - Preflight

1. Have there been any changes to the alembic migrations? Follow the <migration-instructions>
2. Have there been any changes to the /ui? Follow the <frontend-instructions>
3. Have there been any changes to the /tests directory? Follow the <testing-instructions>

## General things to look for

<migration-instructions>
1. If a new migration was added:
	- Warn the user and only proceed after getting explicit consent:
	- Run an idempotency check:
	    - uv run alembic upgrade head
			- uv run alembic downgrade -1
      - uv run alembic upgrade head
	- If downgrade doesn't work, try using batch operations.
2. Every migration MUST have a functional downgrade() that reverses the upgrade(). No pass downgrades!
</migration-instructions>

<frontend-instructions>
1. Look for any new `fetch` requests and try to replace them with the generated client sdk instead.
</frontend-instruction>

<api-instructions>
    Confirm that any new date fields are returned in ISO 8601 format with timezone (e.g. "2023-10-05T14:48:00.000Z").
    Ensure that any new endpoints follow RESTful conventions and use appropriate HTTP methods (GET, POST, PUT, DELETE).
</api-instructions>

<testing-instructions>
1. Do the changes adhere to our testing philosophy in @tests/CLAUDE.md?
</testing-instructions>

## Stage 1 - Vibe Check
- Any high level concerns?
- What parts are confusing?

## Stage 2 - Reduce, Recycle, Reuse
- Identify the pieces that are net new additions.
	- Describe them.
	- Are there any opportunities to reuse existing functionality?

## Stage 3 - Well Actually
- Pick a piece of code from the PR and show me how you would write it instead.
- Use this as an opportunity to teach me about any new additions to the language or framework that I may not have been aware of. But only if it's relevant. I learn best when I can apply concepts or techniques in my day to day.

## Stage 4 - Final Sweep
* Look for any stray logs or debug statements. Is there any relevant documentation that should be updated?