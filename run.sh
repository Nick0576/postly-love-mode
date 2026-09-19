#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=== Starting: $(date) ==="

echo ""
echo "--- Phase 1: Pin favorite games ---"
# A local favorite games catalog that both sides reference. Persisted in our
# own dedicated table so the preset list, settings toggle, and profile page
# all agree without needing to duplicate the list across files.
pnpm db:migrate 2>&1 | tail -20 || true

echo ""
echo "=== Done: $(date) ==="
