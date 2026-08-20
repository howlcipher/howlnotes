#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BIN_DIR="${REPO_ROOT}/bin"
DEPS_DIR="${REPO_ROOT}/.deps"

PINNED_HOWLFRAME_REV="7cdc5116d426cc05c505d6457dc24aeb4fcc2046"

mkdir -p "${BIN_DIR}" "${DEPS_DIR}"

HOWLFRAME_SRC=""

if [[ -n "${HOWLFRAME_BIN:-}" && -x "${HOWLFRAME_BIN}" ]]; then
  echo "==> Using explicit HOWLFRAME_BIN: ${HOWLFRAME_BIN}"
  ln -sf "${HOWLFRAME_BIN}" "${BIN_DIR}/howlframe"
  exit 0
fi

if [[ -n "${HOWLFRAME_ROOT:-}" && -d "${HOWLFRAME_ROOT}" ]]; then
  echo "==> Using HOWLFRAME_ROOT: ${HOWLFRAME_ROOT}"
  HOWLFRAME_SRC="${HOWLFRAME_ROOT}"
elif [[ -d "${REPO_ROOT}/../howlframe" ]]; then
  echo "==> Detected sibling HowlFrame repository at ${REPO_ROOT}/../howlframe"
  HOWLFRAME_SRC="${REPO_ROOT}/../howlframe"
else
  echo "==> Bootstrapping pinned HowlFrame (${PINNED_HOWLFRAME_REV}) into ${DEPS_DIR}/howlframe"
  if [[ ! -d "${DEPS_DIR}/howlframe/.git" ]]; then
    git clone https://github.com/howlcipher/howlframe.git "${DEPS_DIR}/howlframe"
  fi
  (
    cd "${DEPS_DIR}/howlframe"
    git fetch origin
    git checkout "${PINNED_HOWLFRAME_REV}"
  )
  HOWLFRAME_SRC="${DEPS_DIR}/howlframe"
fi

echo "==> Building HowlFrame compiler/runtime from ${HOWLFRAME_SRC}..."
(
  cd "${HOWLFRAME_SRC}"
  go build -o "${BIN_DIR}/howlframe" howlframe.go
)

echo "==> Verifying HowlFrame binary..."
"${BIN_DIR}/howlframe" --version
echo "==> HowlFrame bootstrap complete. Binary at ${BIN_DIR}/howlframe"
