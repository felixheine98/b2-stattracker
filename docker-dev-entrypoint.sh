#!/bin/sh
set -e
npm install
npx prisma generate
npx prisma db push --skip-generate
node prisma/seed.js
exec npx next dev --webpack -H 0.0.0.0 -p 3000
