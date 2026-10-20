#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BIN="${REPO_ROOT}/bin/howlframe"
BUILD_DIR="${REPO_ROOT}/build"
PORT="8088" # The port is declared in app/backend.howl and compiled into bytecode.

if [[ ! -x "${BIN}" || ! -f "${BUILD_DIR}/backend.hfbc" || ! -f "${REPO_ROOT}/static/app.js" ]]; then
  echo "==> Building HowlNotes before running..."
  "${SCRIPT_DIR}/build.sh"
fi

mkdir -p "${REPO_ROOT}/data"

echo "=========================================================="
echo " HowlNotes (dogfooding HowlFrame)"
echo " Server URL:    http://localhost:${PORT}"
echo " Capabilities:  network,database,filesystem"
echo " Storage URI:   file://data/notes.json"
echo " Bytecode:      ${BUILD_DIR}/backend.hfbc"
echo "=========================================================="

# The backend reads static/ and stores file://data/notes.json relative to the
# working directory, so run from the repository root wherever this is called.
cd "${REPO_ROOT}"
exec "${BIN}" -run-bc -allow-caps network,database,filesystem "${BUILD_DIR}/backend.hfbc"
