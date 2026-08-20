#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Running HowlNotes test suite..."
(
  cd "${REPO_ROOT}/tests"
  go test -v ./...
)

echo "==> All tests passed!"
