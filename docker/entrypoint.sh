#!/bin/sh
set -e

if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "Applying Prisma migrations..."
  npx prisma migrate deploy
else
  echo "No migrations found yet, syncing schema with 'prisma db push'..."
  npx prisma db push
fi

exec node dist/src/main.js
