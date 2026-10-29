#!/bin/sh
# Container start step: apply pending Prisma migrations.
# Databases created by the old start command (`prisma db push`) have tables but no
# _prisma_migrations history, so `migrate deploy` stops with P3005 without changing
# anything. Such a database is baselined at 1_init only when its live schema matches
# prisma/baseline/1_init.prisma exactly; any other difference stops startup and the
# database is left unchanged.
set -u
cd "$(dirname "$0")/.."

if out=$(npx prisma migrate deploy 2>&1); then
  printf '%s\n' "$out"
  exit 0
fi
printf '%s\n' "$out"
case "$out" in
  *P3005*) ;;
  *) exit 1 ;;
esac

echo "migrate-deploy: no migration history; comparing the live schema with prisma/baseline/1_init.prisma"
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/baseline/1_init.prisma --script --exit-code
case $? in
  0) ;;
  2) echo "migrate-deploy: live schema differs from 1_init (SQL above); not baselining, database left unchanged" >&2; exit 1 ;;
  *) exit 1 ;;
esac

npx prisma migrate resolve --applied 1_init || echo "migrate-deploy: 1_init not recorded by this instance; continuing"
npx prisma migrate deploy
