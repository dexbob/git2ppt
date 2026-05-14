#!/bin/bash

# 빌드 실패 시 서버가 안 뜨도록 막아줍니다.
set -e

# 사용법:
#   ./start_server.sh local     # 로컬 개발 (HMR, 5173)
#   ./start_server.sh       # 외부(Tailscale) 노출 (빌드 + 정적 서빙, 8787)
if [ "${1:-}" = "local" ]; then
    npm run dev
else
    npm run build
    SERVE_STATIC=1 npm run dev:server
fi