#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BIN_DIR="${REPO_ROOT}/bin"
DEPS_DIR="${REPO_ROOT}/.deps"

PINNED_HOWLFRAME_TAG="v0.1.0"

mkdir -p "${BIN_DIR}" "${DEPS_DIR}"

HOWLFRAME_SRC=""

# 1. Explicit developer binary override
if [[ -n "${HOWLFRAME_BIN:-}" && -x "${HOWLFRAME_BIN}" ]]; then
  echo "==> Using explicit HOWLFRAME_BIN: ${HOWLFRAME_BIN}"
  ln -sf "${HOWLFRAME_BIN}" "${BIN_DIR}/howlframe"

# 2. Standard $PATH resolution for installed HowlFrame release
elif command -v howlframe >/dev/null 2>&1; then
  SYSTEM_HOWLFRAME="$(command -v howlframe)"
  echo "==> Using HowlFrame from PATH: ${SYSTEM_HOWLFRAME}"
  ln -sf "${SYSTEM_HOWLFRAME}" "${BIN_DIR}/howlframe"

# 3. Explicit developer source override (HOWLFRAME_ROOT)
elif [[ -n "${HOWLFRAME_ROOT:-}" && -d "${HOWLFRAME_ROOT}" ]]; then
  echo "==> Using explicit HOWLFRAME_ROOT: ${HOWLFRAME_ROOT}"
  HOWLFRAME_SRC="${HOWLFRAME_ROOT}"

# 4. Bootstrap pinned HowlFrame release tag into local dependencies
else
  echo "==> Bootstrapping pinned HowlFrame (${PINNED_HOWLFRAME_TAG}) into ${DEPS_DIR}/howlframe"
  if [[ ! -d "${DEPS_DIR}/howlframe/.git" ]]; then
    git clone --depth 1 --branch "${PINNED_HOWLFRAME_TAG}" https://github.com/howlcipher/howlframe.git "${DEPS_DIR}/howlframe"
  fi
  (
    cd "${DEPS_DIR}/howlframe"
    git checkout "${PINNED_HOWLFRAME_TAG}"
  )
  HOWLFRAME_SRC="${DEPS_DIR}/howlframe"
fi

if [[ -n "${HOWLFRAME_SRC}" ]]; then
  echo "==> Building HowlFrame compiler/runtime from ${HOWLFRAME_SRC}..."
  (
    cd "${HOWLFRAME_SRC}"
    go build -o "${BIN_DIR}/howlframe" howlframe.go
  )
fi

echo "==> Verifying HowlFrame binary and minimum version..."
VERSION_OUT="$("${BIN_DIR}/howlframe" --version)"
echo "${VERSION_OUT}"
if ! echo "${VERSION_OUT}" | grep -q "HowlFrame 0.1."; then
  echo "ERROR: HowlFrame binary version incompatible; requires >= 0.1.0" >&2
  exit 1
fi
echo "==> HowlFrame bootstrap complete. Binary at ${BIN_DIR}/howlframe"
