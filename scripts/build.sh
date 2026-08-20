#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BIN="${REPO_ROOT}/bin/howlframe"
BUILD_DIR="${REPO_ROOT}/build"
STATIC_DIR="${REPO_ROOT}/static"

if [[ ! -x "${BIN}" ]]; then
  echo "==> HowlFrame binary not found, running bootstrap..."
  "${SCRIPT_DIR}/bootstrap.sh"
fi

mkdir -p "${BUILD_DIR}" "${STATIC_DIR}" "${REPO_ROOT}/data"

echo "==> [1/2] Compiling HowlFrame backend (app/backend.howl -> build/backend.hfbc)..."
"${BIN}" -compile-bc "${REPO_ROOT}/app/backend.howl" -o "${BUILD_DIR}/backend.hfbc"

echo "==> [2/2] Compiling HowlFrame frontend (app/frontend.howl -> static/app.js)..."
"${BIN}" "${REPO_ROOT}/app/frontend.howl" -o "${STATIC_DIR}/"

echo "==> Build complete!"
