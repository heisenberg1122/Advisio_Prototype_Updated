#!/bin/sh
set -eu

if [ "${ADVISIO_EVALUATION:-}" != "1" ] || [ "${EVALUATION_DATA_DIR:-}" != "/var/lib/advisio-evaluation" ]; then
  echo "The evaluation container requires its dedicated evaluation mode and storage mount." >&2
  exit 1
fi

# Render mounts persistent disks as root. Limit this initialization to the one
# literal mount, then run the web process without root privileges.
install -d -m 0700 -o node -g node /var/lib/advisio-evaluation
exec gosu node node /app/scripts/start-evaluation.mjs
