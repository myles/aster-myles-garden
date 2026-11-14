#!/usr/bin/env bash
# Runs the browser tests in Playwright's Linux Docker image, the same one
# CI uses, so wheel screenshots are compared against the approved ones.
#
# Usage:
#   scripts/e2e-linux-run.sh                      # compare
#   scripts/e2e-linux-run.sh --update-snapshots   # approve new ones
#
# Extra arguments go to `playwright test`.

set -euo pipefail

# The image's browsers must match the installed @playwright/test.
PLAYWRIGHT_VERSION="$(npx playwright --version | awk '{ print $2 }')"
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"

# The tests run on a copy of the repository, not the host's checkout: its
# node_modules has macOS binaries, and the build would overwrite the
# host's dist and .vercel. Screenshots and reports are copied back.
# Install scripts are skipped: they only build @swisseph/node, for the
# API, which the browser tests don't call, and the image has no compiler.
CONTAINER_SCRIPT='
  set -uo pipefail
  tar -C /host --exclude=./node_modules --exclude=./dist \
    --exclude=./.vercel --exclude=./.git -cf - . | tar -C /work -xf -
  cd /work
  npm ci --ignore-scripts --no-audit --no-fund || exit 1

  npx playwright test "$@"
  status=$?

  rm -rf /host/e2e/__screenshots__ /host/playwright-report /host/test-results
  cp -a e2e/__screenshots__ /host/e2e/
  cp -a playwright-report test-results /host/
  exit $status
'

docker run --rm --ipc=host \
  --volume "$PWD:/host" \
  "$IMAGE" \
  bash -c "mkdir /work && $CONTAINER_SCRIPT" -- "$@"
