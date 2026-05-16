#!/bin/bash

# 빌드 실패 시 서버가 안 뜨도록 막아줍니다.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SCRIPT_NAME="$(basename "$0")"
MODE="${1:-}"

print_install_hint() {
  echo "" >&2
  echo "의존성이 설치되어 있지 않거나 불완전합니다." >&2
  echo "프로젝트 루트에서 다음을 실행한 뒤 다시 시도하세요:" >&2
  echo "" >&2
  echo "  npm install" >&2
  echo "" >&2
  if [ "$MODE" = "local" ]; then
    echo "  ./${SCRIPT_NAME} local" >&2
  else
    echo "  ./${SCRIPT_NAME}" >&2
  fi
}

require_deps() {
  if [ ! -d node_modules ]; then
    echo "오류: node_modules 디렉터리가 없습니다." >&2
    print_install_hint
    exit 1
  fi
  for bin in tsc vite tsx; do
    if [ ! -x "node_modules/.bin/${bin}" ]; then
      echo "오류: node_modules/.bin/${bin} 을(를) 찾을 수 없습니다." >&2
      print_install_hint
      exit 1
    fi
  done
}

hint_from_log_if_missing_deps() {
  local log_file="$1"
  if grep -qE 'tsc: not found|vite: not found|tsx: not found|sh: [0-9]+: (tsc|vite|tsx): not found|Cannot find module' "$log_file"; then
    print_install_hint
  elif [ ! -d node_modules ]; then
    print_install_hint
  fi
}

# 사용법:
#   ./start_server.sh local     # 로컬 개발 (HMR, 5173)
#   ./start_server.sh           # 외부(Tailscale) 노출 (빌드 + 정적 서빙, 8787)
require_deps

if [ "$MODE" = "local" ]; then
  if ! npm run dev; then
    status=$?
    if [ ! -d node_modules ] || [ ! -x node_modules/.bin/tsc ]; then
      print_install_hint
    fi
    exit "$status"
  fi
else
  build_log="$(mktemp)"
  trap 'rm -f "$build_log"' EXIT
  set +e
  npm run build >"$build_log" 2>&1
  build_status=$?
  set -e
  cat "$build_log"
  if [ "$build_status" -ne 0 ]; then
    hint_from_log_if_missing_deps "$build_log"
    exit "$build_status"
  fi
  SERVE_STATIC=1 npm run dev:server
fi
