#!/usr/bin/env bash
# Restart the Studio server on a fresh empty DCDrive.mo (the e2e script authors it from nothing).
# Runs in $WORK (default /tmp/squero-e2e); needs a paperboat binary (see bin/squero-om).
here="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "${WORK:=/tmp/squero-e2e}" && cd "$WORK" || exit 1
pkill -f "[p]aperboat squero" 2>/dev/null; sleep 1
printf 'model DCDrive\nend DCDrive;\n' > DCDrive.mo
(nohup "$here/bin/squero-om" DCDrive.mo --port 8790 >/tmp/squero.log 2>&1 &)
until curl -s -o /dev/null localhost:8790/; do sleep 0.5; done
