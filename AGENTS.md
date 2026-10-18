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

Every change goes to dev first. Production is only rebuilt after Felix has looked at the change in dev and confirmed it, each time anew: an earlier go-ahead does not cover the next change. The same holds for changes to the production data.

## Dev-only logo and favicon

Felix explicitly requires the orange logo and favicon to remain exclusive to the dev environment. This is a permanent environment marker, not a branding change to promote to production. Production must retain the original B2 artwork and colors, including after future deployments.

- `components/brand-logo.tsx` and the icon metadata in `app/layout.tsx` select the orange assets only when `NODE_ENV === "development"` (`next dev`). Preserve this condition.
- The orange assets are `public/b2-logo-dev.svg`, `public/icon-dev.svg` and `public/favicon-dev.ico`; never select them in production or overwrite the original assets with them.
- This applies to the sidebar, mobile header, login screen and browser favicon. A general approval to deploy other changes does not authorize orange production branding.

## Format rules per competition stay dev-only

Felix is not yet sure about the format rules per competition (match rules, hints, points, rule templates; `docs/adr/005-comp-formatregeln.md`). They must never reach production until he explicitly decides otherwise, and a general approval to deploy other changes does not cover them.

- `lib/features.ts` (`matchRulesEnabled`) switches them on only where `MATCH_RULES=on` is set (`docker-compose.dev.yml`) and always off when `NODE_ENV === "production"`. Preserve this condition; do not set `MATCH_RULES` in `docker-compose.yml`.
- Felix explicitly approved merging all local work into `main` on 18.10.2026. The format-rule code is now included in `main`, but remains disabled in production until he explicitly approves activating this feature.
- Switched off, the app behaves as before: no rule fields or template controls, no hints or points, no rules required for new competitions. Stored rules and templates stay in the database.

# Mobile

Every change to the interface has to work on phones as well as on desktop. Below 768px (`md`) the app uses its phone layout: bottom bar instead of the sidebar, full-screen dialogs, wide tables that scroll sideways or turn into cards.

- Page headers and button rows wrap instead of overflowing; nothing may make a page scroll sideways.
- Multi-column forms and grids stack on phones (`grid-cols-1 sm:grid-cols-2`).
- Button rows of dialogs use the `dialog-footer` class, so they stay visible at the bottom.
- Fields that open a keyboard keep at least 16px font size on phones (handled in `globals.css`), otherwise iPhones zoom in.
- Tables: stats keep all columns and scroll with a sticky first column; lists that are edited per row become cards (`max-md:` classes on the same table).

# Page width

On a computer a page is as wide as one of two classes from `globals.css` allows: `page-wide` for pages with data, `page-narrow` for pages that are a form. A page never sets a maximum width of its own. Sections that stand side by side on wide screens use `page-columns` (2:1) or `page-columns-even` (1:1) with one section marked `page-main`; below 1536px they stand below one another in the order of the code (see `docs/adr/003-seitenbreite.md`).

# Todos

`todos.md` is kept in five sections, in this order: `Offen` (open) at the top, `Teilweise erledigt` (partly done) below it, `Unter Beobachtung` (built, being watched in use), `Low Prio`, and `Erledigt` (done) at the bottom. Its second line links to `ideen.md`, which collects ideas that are not todos yet. Whenever you add an item or change its status, move it to the matching section instead of leaving it in place. A partly done item lists its finished and open parts as sub-checkboxes.
