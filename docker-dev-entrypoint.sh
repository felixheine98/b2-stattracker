#!/bin/sh
set -e
npm install
npx prisma generate
# What db push cannot do on its own: a required column for a table that has rows
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261013020000_add_comp_style/migration.sql
npx prisma db push --skip-generate
node prisma/seed.js
exec npx next dev --webpack -H 0.0.0.0 -p 3000
