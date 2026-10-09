<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Branching

Do not create a new branch for every task. For small, quick tasks, do not branch at all: commit directly on the current branch, including `main`. For larger work, branch off `main` at most once and keep working on that branch for subsequent tasks. If you think an additional branch is warranted, ask first instead of creating it on your own.

# Testing

Changes to logic (calculations, data transformations, anything in `lib/`) are done test-first: write a failing test, then the code that passes it. Keep such logic in plain `.ts` modules without JSX so it can be tested directly. Pure UI and layout changes need no tests.

Tests are Vitest files next to the module (`lib/foo.test.ts`). The host has Node 18, which is too old for Vitest, so run tests, typecheck and lint inside the app container:

```
docker compose exec app npm test
docker compose exec app npx tsc --noEmit -p .
```

# Mobile

Every change to the interface has to work on phones as well as on desktop. Below 768px (`md`) the app uses its phone layout: bottom bar instead of the sidebar, full-screen dialogs, wide tables that scroll sideways or turn into cards.

- Page headers and button rows wrap instead of overflowing; nothing may make a page scroll sideways.
- Multi-column forms and grids stack on phones (`grid-cols-1 sm:grid-cols-2`).
- Button rows of dialogs use the `dialog-footer` class, so they stay visible at the bottom.
- Fields that open a keyboard keep at least 16px font size on phones (handled in `globals.css`), otherwise iPhones zoom in.
- Tables: stats keep all columns and scroll with a sticky first column; lists that are edited per row become cards (`max-md:` classes on the same table).
