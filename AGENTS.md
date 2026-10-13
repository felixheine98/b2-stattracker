<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Branching

Do not create a new branch for every task. For small, quick tasks, do not branch at all: commit directly on the current branch, including `main`. For larger work, branch off `main` at most once and keep working on that branch for subsequent tasks. If you think an additional branch is warranted, ask first instead of creating it on your own.

# Testing

Changes to logic (calculations, data transformations, anything in `lib/`) are done test-first: write a failing test, then the code that passes it. Keep such logic in plain `.ts` modules without JSX so it can be tested directly. Pure UI and layout changes need no tests.

Tests are Vitest files next to the module (`lib/foo.test.ts`). The host has Node 18, which is too old for Vitest, so run tests, typecheck and lint inside the dev container (the production container has neither the sources nor the dev dependencies):

```
docker compose -f docker-compose.dev.yml exec app npm test
docker compose -f docker-compose.dev.yml exec app npx tsc --noEmit -p .
```

Tests that need PostgreSQL create a temporary schema in the dev database and remove it again. They are skipped unless asked for: `env DB_TESTS=1 npm test` for route tests (`app/api/**/route.test.ts`), `env TFH_DB_TESTS=1 npm test` for the TFH archive.

# Production and dev

Two setups run side by side:

- Production (`docker-compose.yml`, served under `BASE_PATH`): a built image. Code changes only show up after `docker compose up -d --build`.
- Dev (`docker-compose.dev.yml`, served under `DEV_BASE_PATH`, default `/stats-dev`): `next dev` on the mounted source with hot reload, and its own database, a copy of the production data. Schema changes are applied there on restart (`docker compose -f docker-compose.dev.yml restart app`), never to production.

# Mobile

Every change to the interface has to work on phones as well as on desktop. Below 768px (`md`) the app uses its phone layout: bottom bar instead of the sidebar, full-screen dialogs, wide tables that scroll sideways or turn into cards.

- Page headers and button rows wrap instead of overflowing; nothing may make a page scroll sideways.
- Multi-column forms and grids stack on phones (`grid-cols-1 sm:grid-cols-2`).
- Button rows of dialogs use the `dialog-footer` class, so they stay visible at the bottom.
- Fields that open a keyboard keep at least 16px font size on phones (handled in `globals.css`), otherwise iPhones zoom in.
- Tables: stats keep all columns and scroll with a sticky first column; lists that are edited per row become cards (`max-md:` classes on the same table).

# Todos

`todos.md` is kept in three sections, in this order: `Offen` (open) at the top, `Teilweise erledigt` (partly done) below it, `Erledigt` (done) at the bottom. Whenever you add an item or change its status, move it to the matching section instead of leaving it in place. A partly done item lists its finished and open parts as sub-checkboxes.
