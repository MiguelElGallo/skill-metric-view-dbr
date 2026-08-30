#!/bin/sh
set -u

CHECKER_BIN_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CHECKER_PLUGIN_ROOT=${PLUGIN_ROOT:-$(CDPATH= cd -- "$CHECKER_BIN_DIR/.." && pwd)}
CHECKER_ENTRY="$CHECKER_PLUGIN_ROOT/dist/checker.mjs"
CHECKER_RUNTIME=""
CHECKER_ELECTRON=0

select_runtime() {
  CHECKER_CANDIDATE=$1
  CHECKER_CANDIDATE_ELECTRON=$2
  [ -n "$CHECKER_CANDIDATE" ] || return 1
  [ -x "$CHECKER_CANDIDATE" ] || return 1

  if [ "$CHECKER_CANDIDATE_ELECTRON" -eq 1 ]; then
    CHECKER_MAJOR=$(ELECTRON_RUN_AS_NODE=1 "$CHECKER_CANDIDATE" -p 'process.versions.node.split(".")[0]' 2>/dev/null) || return 1
  else
    CHECKER_MAJOR=$("$CHECKER_CANDIDATE" -p 'process.versions.node.split(".")[0]' 2>/dev/null) || return 1
  fi

  case "$CHECKER_MAJOR" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$CHECKER_MAJOR" -ge 20 ] || return 1

  CHECKER_RUNTIME=$CHECKER_CANDIDATE
  CHECKER_ELECTRON=$CHECKER_CANDIDATE_ELECTRON
  return 0
}

select_runtime "${DATABRICKS_METRIC_VIEW_NODE:-}" 0 || true

if [ -z "$CHECKER_RUNTIME" ] && [ "${DATABRICKS_METRIC_VIEW_SKIP_SYSTEM_NODE:-0}" != "1" ]; then
  CHECKER_PATH_NODE=$(command -v node 2>/dev/null || true)
  select_runtime "$CHECKER_PATH_NODE" 0 ||
    select_runtime "/opt/homebrew/bin/node" 0 ||
    select_runtime "/usr/local/bin/node" 0 ||
    select_runtime "/usr/bin/node" 0 || true
fi

if [ -z "$CHECKER_RUNTIME" ]; then
  select_runtime "${DATABRICKS_METRIC_VIEW_HOST_RUNTIME:-}" 1 || true
fi

if [ -z "$CHECKER_RUNTIME" ]; then
  CHECKER_PARENT=""
  if [ -r "/proc/$PPID/exe" ]; then
    CHECKER_PARENT=$(readlink "/proc/$PPID/exe" 2>/dev/null || true)
  elif command -v ps >/dev/null 2>&1; then
    CHECKER_PARENT=$(ps -p "$PPID" -o comm= 2>/dev/null || true)
  fi
  select_runtime "$CHECKER_PARENT" 1 || true
fi

if [ -z "$CHECKER_RUNTIME" ]; then
  for CHECKER_VSCODE in \
    "/Applications/Visual Studio Code.app/Contents/MacOS/Code" \
    "${HOME:-}/Applications/Visual Studio Code.app/Contents/MacOS/Code" \
    "/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Code - Insiders" \
    "/usr/share/code/code" \
    "/usr/lib/code/code" \
    "/snap/code/current/usr/share/code/code"
  do
    if select_runtime "$CHECKER_VSCODE" 1; then
      break
    fi
  done
fi

if [ -z "$CHECKER_RUNTIME" ]; then
  echo "databricks-metric-view: could not find the host's bundled Node runtime or Node.js 20+" >&2
  exit 127
fi

if [ "$CHECKER_ELECTRON" -eq 1 ]; then
  ELECTRON_RUN_AS_NODE=1 exec "$CHECKER_RUNTIME" "$CHECKER_ENTRY" "$@"
else
  exec "$CHECKER_RUNTIME" "$CHECKER_ENTRY" "$@"
fi
