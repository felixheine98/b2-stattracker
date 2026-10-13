#!/bin/sh
set -e
# What db push cannot do on its own: a required column for a table that has rows
node node_modules/prisma/build/index.js db execute --schema prisma/schema.prisma --file prisma/migrations/20261013020000_add_comp_style/migration.sql
node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss
node prisma/seed.js
exec node server.js
