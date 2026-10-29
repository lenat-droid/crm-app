#!/bin/sh
# Container start: apply migrations, start the AIM notification worker when its mail
# settings are complete, then hand the process over to the web server.
set -u
cd "$(dirname "$0")/.."

sh scripts/migrate-deploy.sh || exit 1

# With incomplete settings the worker is not started and queued notifications stay
# pending until the settings are added and the container restarts.
if node --import tsx scripts/aim-notifications.ts --check-config; then
  (
    while :; do
      node --import tsx scripts/aim-notifications.ts
      echo "start: notification worker exited ($?); restarting in 10s" >&2
      sleep 10
    done
  ) &
fi

exec node server.js
